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
    updateDataInterval: 0, // Sonntag
    updateInterval: 60 * 60 * 1000, // stündlich
    schedule: [],
  },

  // Module initialization
  start: function () {
    this.trashData = null;
    this.errorMessage = null;
    this.updateTrashData();

    setInterval(() => {
      this.update();
    }, this.config.updateInterval);
  },

  update: function () {
    const today = new Date().getDay();
    if (today === this.config.updateDataInterval) {
      this.updateTrashData();
    } else {
      if (!this.trashData) {
        this.updateTrashData();
      } else {
        this.updateDom();
      }
    }
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
    return color.startsWith("#") ? color : `#${color}`;
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

    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowFormatted = tomorrow.toISOString().split("T")[0];

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
    colorCell.style.padding = "5px";
    colorCell.style.width = "6px";
    colorCell.style.backgroundColor = collection.color;
    row.appendChild(colorCell);

    const titleCell = document.createElement("td");
    titleCell.className = "trash-collection-title";
    titleCell.style.padding = "5px";
    titleCell.innerHTML = collection.title;
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
