/* MagicMirror2 Module: MMM-MyMuell */

Module.register("MMM-MyMuell", {
  // Default module config
  defaults: {
    provider: "jumomind", // "jumomind" oder "awido"

    // Provider "jumomind"
    cityId: "",
    areaId: "",

    // Provider "awido"
    client: "",
    oid: "",
    includeSpecialEvents: false, // Sondertermine (ReparaturCafé, Putzete, ...) mit anzeigen

    description: false,
    colorBoost: true, // blasse API-Farben kraeftiger darstellen
    colorBarWidth: "14px", // Breite des Farbbalkens je Tonne
    updateDataInterval: 0, // Sonntag
    updateInterval: 60 * 60 * 1000, // stündlich
    schedule: [],

    // Markierte Tonnen per MQTT, z.B. aus Home Assistant (null = aus).
    // markedTopic liefert {"Restmüll": "2026-10-31 14:02:11", ...}, Schlüssel = Titel der Tonne.
    // Nach der Abholung geht {"title", "markiert"} an collectedTopic.
    mqtt: null, // { server, username, password, markedTopic, collectedTopic }
    markedColor: "red",
    collectedAfterHour: 12, // am Abholtag erst ab dieser Stunde markiert = gilt für die nächste Abholung
  },

  // Module initialization
  start: function () {
    this.trashData = null;
    this.errorMessage = null;
    this.markedBins = {};
    this.reportedBins = {};
    this.updateTrashData();

    if (this.config.mqtt) {
      this.sendSocketNotification("MQTT_CONFIG", Object.assign({
        markedTopic: "magicmirror/muell/markiert",
        collectedTopic: "magicmirror/muell/abgeholt",
      }, this.config.mqtt));
    }

    setInterval(() => {
      this.update();
    }, this.config.updateInterval);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "MARKED_BINS") {
      this.markedBins = payload || {};
      this.reportCollectedBins();
      this.updateDom();
    }
  },

  update: function () {
    const today = new Date().getDay();
    if (today === this.config.updateDataInterval) {
      this.updateTrashData();
    } else {
      if (!this.trashData) {
        this.updateTrashData();
      } else {
        this.reportCollectedBins();
        this.updateDom();
      }
    }
  },

  /*
   * Meldet markierte Tonnen, deren Abholung seit der Markierung vorbei ist.
   * Läuft bei jeder Aktualisierung, holt also auch nach, wenn der Spiegel
   * am Tag nach der Abholung aus war.
   */
  reportCollectedBins: function () {
    if (!this.trashData) {
      return;
    }
    const today = this.formatDate(new Date());

    Object.entries(this.markedBins).forEach(([title, markedAt]) => {
      if (this.reportedBins[title] === markedAt) {
        return;
      }
      const markedDay = String(markedAt).slice(0, 10);
      const markedHour = parseInt(String(markedAt).slice(11, 13), 10) || 0;

      const collected = this.trashData.some((collection) =>
        collection.title === title &&
        collection.day < today &&
        (collection.day > markedDay ||
          (collection.day === markedDay && markedHour < this.config.collectedAfterHour)));

      if (collected) {
        this.reportedBins[title] = markedAt;
        this.sendSocketNotification("BIN_COLLECTED", { title, markiert: markedAt });
      }
    });
  },

  // Lokales Datum als "2026-10-31" (toISOString wäre UTC und kippt um Mitternacht zu spät)
  formatDate: function (date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  },

  // Fetches the trash collection data from the configured provider
  updateTrashData: function () {
    const provider = (this.config.provider || "jumomind").toLowerCase();

    let request;
    if (provider === "jumomind") {
      request = this.fetchJumomind();
    } else if (provider === "awido") {
      request = this.fetchAwido();
    } else {
      this.errorMessage = `Unbekannter provider: ${this.config.provider}`;
      this.trashData = [];
      this.updateDom();
      return;
    }

    request
      .then((collections) => {
        this.errorMessage = null;
        this.trashData = collections;
      })
      .catch((error) => {
        Log.error(`${this.name}: ${error.message}`);
        this.errorMessage = error.message;
        this.trashData = [];
      })
      .finally(() => {
        this.reportCollectedBins();
        this.updateDom();
      });
  },

  /*
   * Liefert die Termine der MyMuell-API (jumomind).
   * Rückgabe: normalisierte Einträge { day, title, color, description }
   */
  fetchJumomind: async function () {
    if (!this.config.cityId || !this.config.areaId) {
      throw new Error("cityId und areaId müssen gesetzt sein");
    }

    const url = `https://mymuell.jumomind.com/mmapp/api.php?r=dates&city_id=${this.config.cityId}&area_id=${this.config.areaId}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`MyMuell-API antwortet mit HTTP ${response.status}`);
    }

    const dates = await response.json();
    if (!Array.isArray(dates)) {
      return [];
    }

    return dates.map((entry) => ({
      day: entry.day,
      title: entry.title,
      color: this.normalizeColor(entry.color),
      description: entry.description || "",
    }));
  },

  /*
   * Liefert die Termine der AWIDO-API (Cube Four).
   * Ein Aufruf liefert den kompletten Kalender des laufenden Jahres.
   */
  fetchAwido: async function () {
    if (!this.config.client || !this.config.oid) {
      throw new Error("client und oid müssen gesetzt sein");
    }

    const url = `https://awido.cubefour.de/WebServices/Awido.Service.svc/secure/getData/${this.config.oid}?fractions=&client=${this.config.client}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`AWIDO-API antwortet mit HTTP ${response.status}`);
    }

    const data = await response.json();

    // Fraktionskürzel ("RM") auf die Fraktion mit Name und Farbe abbilden
    const fractions = {};
    (data.fracts || []).forEach((fraction) => {
      fractions[fraction.snm] = fraction;
    });

    const collections = [];
    (data.calendar || []).forEach((item) => {
      // Feiertage haben kein "ad" und sind keine Abfuhrtermine
      if (!item.ad) {
        return;
      }

      const addresses = item.ad || [];
      (item.fr || []).forEach((shortName, index) => {
        const fraction = fractions[shortName];
        if (!fraction) {
          return;
        }
        // "son" markiert Sondertermine wie ReparaturCafé oder WarenTauschTage
        if (fraction.son && !this.config.includeSpecialEvents) {
          return;
        }

        collections.push({
          day: this.formatAwidoDate(item.dt),
          title: fraction.nm,
          color: this.normalizeColor(fraction.bg),
          description: addresses[index] || "",
        });
      });
    });

    return collections;
  },

  // Wandelt das AWIDO-Datumsformat "20260916" in "2026-09-16" um
  formatAwidoDate: function (dt) {
    const value = String(dt);
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  },

  // Beide APIs liefern Farben mal mit, mal ohne führendes "#"
  normalizeColor: function (color) {
    if (!color) {
      return "transparent";
    }
    const hex = color.startsWith("#") ? color : `#${color}`;
    return this.config.colorBoost ? this.boostColor(hex) : hex;
  },

  /*
   * Die APIs liefern blasse Pastelltöne (#d9edf7, #fff7cc, ...), die für
   * weiße Webseiten gedacht sind. Auf dem schwarzen Spiegel sehen damit alle
   * Tonnen gleich hell aus, darum Sättigung hoch und Helligkeit in einen
   * kräftigen Bereich ziehen. Graustufen (Restmüll) behalten ihren Ton.
   */
  boostColor: function (hex) {
    const rgb = this.hexToRgb(hex);
    if (!rgb) {
      return hex;
    }

    const hsl = this.rgbToHsl(rgb);
    if (hsl.s < 0.15) {
      hsl.l = 0.78;
    } else {
      hsl.s = Math.max(hsl.s, 0.85);
      hsl.l = Math.min(0.55, Math.max(0.42, hsl.l * 0.55));
    }

    return this.hslToHex(hsl);
  },

  hexToRgb: function (hex) {
    let value = String(hex).replace("#", "").trim();
    if (value.length === 3) {
      value = value
        .split("")
        .map((char) => char + char)
        .join("");
    }
    if (!/^[0-9a-fA-F]{6}$/.test(value)) {
      return null;
    }
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    };
  },

  rgbToHsl: function ({ r, g, b }) {
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;

    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;

    let h = 0;
    if (delta) {
      if (max === red) {
        h = ((green - blue) / delta) % 6;
      } else if (max === green) {
        h = (blue - red) / delta + 2;
      } else {
        h = (red - green) / delta + 4;
      }
      h *= 60;
      if (h < 0) {
        h += 360;
      }
    }

    const l = (max + min) / 2;
    const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

    return { h, s, l };
  },

  hslToHex: function ({ h, s, l }) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let rgb;
    if (h < 60) {
      rgb = [c, x, 0];
    } else if (h < 120) {
      rgb = [x, c, 0];
    } else if (h < 180) {
      rgb = [0, c, x];
    } else if (h < 240) {
      rgb = [0, x, c];
    } else if (h < 300) {
      rgb = [x, 0, c];
    } else {
      rgb = [c, 0, x];
    }

    return `#${rgb.map((value) => Math.round((value + m) * 255).toString(16).padStart(2, "0")).join("")}`;
  },

  // Generates the module content
  getDom: function () {
    const wrapper = document.createElement("div");

    if (this.errorMessage) {
      wrapper.innerHTML = this.errorMessage;
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    if (!this.trashData) {
      wrapper.innerHTML = "Lädt...";
      return wrapper;
    }

    const today = this.formatDate(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowFormatted = this.formatDate(tomorrow);

    const todayCollections = this.trashData.filter((collection) => collection.day === today);
    const tomorrowCollections = this.trashData.filter((collection) => collection.day === tomorrowFormatted);

    if (todayCollections.length === 0 && tomorrowCollections.length === 0) {
      wrapper.innerHTML = "Keine Leerungen geplant";
      return wrapper;
    }

    const table = document.createElement("table");
    table.className = "trash-collection-table";
    table.style.borderCollapse = "collapse";
    table.style.width = "100%";

    if (todayCollections.length > 0) {
      const todayHeaderRow = document.createElement("tr");
      const todayHeaderCell = document.createElement("th");
      todayHeaderCell.className = "trash-collection-header";
      todayHeaderCell.colSpan = this.config.description ? 3 : 2;
      todayHeaderCell.innerHTML = "Heute";
      todayHeaderRow.appendChild(todayHeaderCell);
      table.appendChild(todayHeaderRow);

      todayCollections.forEach((collection) => {
        const row = this.createTableRow(collection);
        table.appendChild(row);
      });
    }

    if (tomorrowCollections.length > 0) {
      const tomorrowHeaderRow = document.createElement("tr");
      const tomorrowHeaderCell = document.createElement("th");
      tomorrowHeaderCell.className = "trash-collection-header";
      tomorrowHeaderCell.colSpan = this.config.description ? 3 : 2;
      tomorrowHeaderCell.innerHTML = "Morgen";
      tomorrowHeaderRow.appendChild(tomorrowHeaderCell);
      table.appendChild(tomorrowHeaderRow);

      tomorrowCollections.forEach((collection) => {
        const row = this.createTableRow(collection);
        table.appendChild(row);
      });
    }

    // Hinweiszeile "Mülltonne rausstellen!"
    if (this.config.schedule.includes(today) || this.config.schedule.includes(tomorrowFormatted)) {
      const infoRow = document.createElement("tr");
      const infoCell = document.createElement("td");
      infoCell.colSpan = this.config.description ? 3 : 2;
      infoCell.className = "trash-collection-info";
      infoCell.innerHTML = "Mülltonne rausstellen!";
      infoCell.style.color = "red";
      infoCell.style.fontWeight = "bold";
      infoCell.style.padding = "6px 4px";
      infoRow.appendChild(infoCell);
      table.insertBefore(infoRow, table.firstChild);
    }

    wrapper.appendChild(table);
    return wrapper;
  },

  // Helper function to create a table row for a trash collection entry
  createTableRow: function (collection) {
    const row = document.createElement("tr");

    const colorCell = document.createElement("td");
    colorCell.className = "trash-collection-color";
    colorCell.style.padding = "5px 0";
    colorCell.style.width = this.config.colorBarWidth;
    colorCell.style.minWidth = this.config.colorBarWidth;
    colorCell.style.backgroundColor = collection.color;
    colorCell.style.borderRadius = "3px";
    row.appendChild(colorCell);

    const titleCell = document.createElement("td");
    titleCell.className = "trash-collection-title";
    titleCell.style.padding = "5px";
    titleCell.innerHTML = collection.title;
    if (this.markedBins[collection.title]) {
      // voll markiert: muss auf jeden Fall raus
      titleCell.style.color = this.config.markedColor;
      titleCell.style.fontWeight = "bold";
    }
    row.appendChild(titleCell);

    if (this.config.description) {
      const descriptionCell = document.createElement("td");
      descriptionCell.className = "trash-collection-description";
      descriptionCell.style.padding = "5px";
      descriptionCell.innerHTML = collection.description;
      row.appendChild(descriptionCell);
    }

    return row;
  }
});
