/* MagicMirror2 Module: TrashCollection */

Module.register("MMM-MyMuell", {
  // Default module config
  defaults: {
    cityId: "",
    areaId: "",
    description: false,
  },

  // Module initialization
  start: function () {
    this.trashData = null;
    this.updateTrashData();
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
    const wrapper = document.createElement("div");
  
    if (!this.trashData) {
      wrapper.innerHTML = "Loading...";
      return wrapper;
    }
  
    const today = new Date().toISOString().split("T")[0];
    const todayCollections = this.trashData.filter((collection) => collection.day === today);
  
    if (todayCollections.length === 0) {
      wrapper.innerHTML = "No trash collection today.";
      return wrapper;
    }
  
    const table = document.createElement("table");
    table.className = "trash-collection-table";
  
    todayCollections.forEach((collection) => {
      const row = document.createElement("tr");
  
      const colorCell = document.createElement("td");
      colorCell.className = "trash-collection-color";
      colorCell.style.backgroundColor = "#" + collection.color;
      row.appendChild(colorCell);
  
      const titleCell = document.createElement("td");
      titleCell.className = "trash-collection-title";
      titleCell.innerHTML = collection.title;
      row.appendChild(titleCell);
  
      if (self.description){
        const descriptionCell = document.createElement("td");
        descriptionCell.className = "trash-collection-description";
        descriptionCell.innerHTML = collection.description;
        row.appendChild(descriptionCell);
      }
  
      table.appendChild(row);
    });
  
    wrapper.appendChild(table);
    return wrapper;
  },
});