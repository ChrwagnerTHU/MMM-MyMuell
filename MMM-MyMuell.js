/* MagicMirror2 Module: TrashCollection */

Module.register("MMM-MyMuell", {
  // Default module config
  defaults: {
    cityId: "",
    areaId: "",
    description: false,
    updateDataInterval: 0, // Sonntag
    updateInterval: 60 * 60 * 1000, // stündlich
    schedule: [],
    includedPerYear: [
      { match: /rest/i, count: 12 }, // Restmüll 12x inkl.
      { match: /bio/i, count: 12 }   // Biomüll 12x inkl.
    ],
    alwaysFree: [/gelb/i, /papier/i],
  },

  // Module initialization
  start: function () {
    this.trashData = null;
    this.updateTrashData();

    setInterval(() => {
      this.update();
    }, this.config.updateInterval);
  },

  update: function () {
    var self = this;
    const today = new Date().getDay();
    if (today === self.updateDataInterval) {
      self.updateTrashData();
    } else {
      if (!this.trashData) {
        self.updateTrashData();
      } else {
        self.updateDom();
      }
    }
  },

  // Fetches the trash collection data for the specified city and area
  updateTrashData: function () {
    const url = `https://mymuell.jumomind.com/mmapp/api.php?r=dates&city_id=${this.config.cityId}&area_id=${this.config.areaId}`;
    var self = this;
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        try {
          const raw = JSON.parse(this.responseText) || [];
          self.trashData = self._withIncludedFlags(raw);
        } catch (e) {
          // Falls JSON fehlschlägt, setze leeres Array
          self.trashData = [];
          // optional: console.error(e);
        }
        self.updateDom();
      }
    };
    xhttp.open("GET", url, true);
    xhttp.send();
  },

  /**
   * NEU: Markiert jede Abholung mit { included: true|false, alwaysFree: true|false }
   * - alwaysFree: per config.alwaysFree (z.B. Gelber Sack, Papier)
   * - included: gleichmäßige Verteilung der in includedPerYear konfigurierten Freimengen
   */
  _withIncludedFlags: function (data) {
    if (!Array.isArray(data)) return [];

    // Nur Termine des aktuellen Jahres für die Verteilung heranziehen
    const currentYear = new Date().getFullYear();

    // Hilfsfunktionen
    const isAlwaysFree = (title) => {
      return (this.config.alwaysFree || []).some((rx) => String(title).match(rx));
    };

    const matchingRule = (title) => {
      return (this.config.includedPerYear || []).find((rule) => String(title).match(rule.match));
    };

    // Tiefkopie + Standard-Flags
    const cloned = data.map((entry) => ({
      ...entry,
      included: false,
      alwaysFree: isAlwaysFree(entry.title)
    }));

    // Gruppiere pro Müllart (nach Regel) innerhalb des aktuellen Jahres
    // Key je Gruppe = String(rule.match) damit jede Regel eigene Verteilung bekommt
    const groups = {}; // { key: [indices in cloned] }
    cloned.forEach((entry, idx) => {
      const y = Number(String(entry.day).slice(0, 4));
      if (isNaN(y) || y !== currentYear) return; // nur aktuelles Jahr
      if (entry.alwaysFree) return; // immer frei -> keine Kontingent-Verteilung nötig
      const rule = matchingRule(entry.title);
      if (!rule) return;
      const key = String(rule.match);
      if (!groups[key]) groups[key] = [];
      groups[key].push(idx);
    });

    // Sortiere jede Gruppe chronologisch und verteile Freimengen gleichmäßig
    Object.keys(groups).forEach((key) => {
      const rule = (this.config.includedPerYear || []).find(r => String(r.match) === key);
      const freeCount = Math.max(0, rule?.count || 0);
      const indices = groups[key];

      // Chronologisch nach "day"
      indices.sort((a, b) => {
        const da = new Date(cloned[a].day);
        const db = new Date(cloned[b].day);
        return da - db;
      });

      const total = indices.length;
      if (total === 0) return;

      if (freeCount >= total) {
        // Alle inklusive
        indices.forEach(i => cloned[i].included = true);
        return;
      }

      if (freeCount <= 0) {
        // Nichts inklusive
        return;
      }

      // Gleichmäßige Verteilung:
      // Wähle freeCount Indizes über den Bereich [0..total-1] ungefähr gleich verteilt.
      const chosen = new Set();
      for (let i = 0; i < freeCount; i++) {
        // Position zwischen 0 und total-1
        const pos = Math.round(((i + 0.5) * total) / freeCount - 0.5);
        const clamped = Math.min(total - 1, Math.max(0, pos));
        chosen.add(clamped);
      }

      // Falls Rundungen Duplikate erzeugen, fülle mit nächstliegenden freien Positionen auf
      let fillIdx = 0;
      while (chosen.size < freeCount && fillIdx < total) {
        if (!chosen.has(fillIdx)) chosen.add(fillIdx);
        fillIdx++;
      }

      // Setze Flags
      Array.from(chosen).forEach((relative) => {
        const absoluteIndex = indices[relative];
        cloned[absoluteIndex].included = true;
      });
    });

    return cloned;
  },

  // Generates the module content
  getDom: function () {
    var self = this;
    const wrapper = document.createElement("div");

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
      todayHeaderCell.colSpan = 4; // +1 Spalte für das Icon
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
      tomorrowHeaderCell.colSpan = 4; // +1 Spalte für das Icon
      tomorrowHeaderCell.innerHTML = "Morgen";
      tomorrowHeaderRow.appendChild(tomorrowHeaderCell);
      table.appendChild(tomorrowHeaderRow);

      tomorrowCollections.forEach(collection => {
        const row = this.createTableRow(collection);
        table.appendChild(row);
      });
    }

    // Hinweiszeile "Mülltonne rausstellen!"
    if (this.config.schedule.includes(today) || this.config.schedule.includes(tomorrowFormatted)) {
      const infoRow = document.createElement("tr");
      const infoCell = document.createElement("td");
      infoCell.colSpan = 4;
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
    colorCell.style.backgroundColor = "#" + collection.color;
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
    } else {
      // Platzhalterzelle, damit die Icon-Spalte immer an gleicher Stelle ist
      const placeholder = document.createElement("td");
      placeholder.style.padding = "5px";
      placeholder.innerHTML = "";
      row.appendChild(placeholder);
    }

    // NEU: Icon/Badge-Spalte
    const badgeCell = document.createElement("td");
    badgeCell.style.padding = "5px";
    badgeCell.style.textAlign = "right";

    // Immer-frei: grüner Haken
    if (collection.alwaysFree) {
      badgeCell.innerHTML = `<span style="font-weight:600; color: #2ecc71;">✅ inklusive</span>`;
    } else if (collection.included) {
      // Im Kontingent: grüner Haken
      badgeCell.innerHTML = `<span style="font-weight:600; color: #2ecc71;">✅ inklusive</span>`;
    } else {
      // Nicht inklusive: rotes Euro-Symbol
      badgeCell.innerHTML = `<span style="font-weight:600; color: #e74c3c;">💶 nicht inklusive</span>`;
    }

    row.appendChild(badgeCell);

    return row;
  }
});
