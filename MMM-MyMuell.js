/* MagicMirror2 Module: TrashCollection */

Module.register("MMM-MyMuell", {
  // Default module config
  defaults: {
    cityId: "",
    areaId: "",
    description: false,
    updateDataInterval: 0, //Sunday
    updateInterval: 60 * 60 * 1000, // every hour
    schedule: []
  },

  // Module initialization
  start: function () {
    this.trashData = null;
    this.updateTrashData();

    setInterval(() => {
      this.update();
    }, this.config.updateInterval);
  },

  update: function(){
    var self = this;
    const today = new Date().getDay();
    if (today === self.updateDataInterval) {
      self.updateTrashData()
    } else {
      if (!this.trashData){
        self.updateTrashData()
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
    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        self.trashData = JSON.parse(this.responseText);
        self.updateDom();
      }
    };
    xhttp.open("GET", url, true);
    xhttp.send();
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
  
    if (todayCollections.length > 0) {
      const todayHeaderRow = document.createElement("tr");
      const todayHeaderCell = document.createElement("th");
      todayHeaderCell.className = "trash-collection-header";
      todayHeaderCell.colSpan = 3;
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
      tomorrowHeaderCell.colSpan = 3;
      tomorrowHeaderCell.innerHTML = "Morgen";
      tomorrowHeaderRow.appendChild(tomorrowHeaderCell);
      table.appendChild(tomorrowHeaderRow);
  
      tomorrowCollections.forEach(collection => {
        const row = this.createTableRow(collection);
        table.appendChild(row);
      });
    }

    if (this.config.schedule.includes(today) || this.config.schedule.includes(tomorrowFormatted)) {
      const infoRow = document.createElement("tr");
      const infoCell = document.createElement("td");
      infoCell.colSpan = 3;
      infoCell.className = "trash-collection-info";
      infoCell.innerHTML = "Mülltonne rausstellen!";
      infoCell.style.color = "red"
      infoRow.appendChild(infoCell);
      table.appendChild(infoRow, table.firstChild);
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
    colorCell.style.backgroundColor = "#" + collection.color;
    row.appendChild(colorCell);
  
    const titleCell = document.createElement("td");
    titleCell.className = "trash-collection-title";
    titleCell.style.padding = "5px";
    titleCell.innerHTML = collection.title;
    row.appendChild(titleCell);
  
    if (this.config.description){
      const descriptionCell = document.createElement("td");
      descriptionCell.className = "trash-collection-description";
      descriptionCell.style.padding = "5px";
      descriptionCell.innerHTML = collection.description;
      row.appendChild(descriptionCell);
    } 
  
    return row;
  }
});