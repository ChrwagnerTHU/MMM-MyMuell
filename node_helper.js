/* MagicMirror2 Module: MMM-MyMuell - node_helper
 *
 * Verbindet sich nur, wenn in der Config "mqtt" gesetzt ist. Empfängt die
 * markierten Tonnen (retained, z.B. von Home Assistant) und meldet nach der
 * Abholung zurück, welche Markierung erledigt ist.
 */
const NodeHelper = require("node_helper");
const mqtt = require("mqtt");

module.exports = NodeHelper.create({
  start: function () {
    this.client = null;
    this.marked = {};
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "MQTT_CONFIG") {
      // Ein Neuladen der Seite schickt die Config erneut, dann nur den letzten Stand nachreichen
      if (this.client) {
        this.sendSocketNotification("MARKED_BINS", this.marked);
        return;
      }
      this.config = payload;
      this.connect();
    } else if (notification === "BIN_COLLECTED" && this.client) {
      console.log(`${this.name}: ${payload.title} abgeholt, Markierung vom ${payload.markiert} erledigt`);
      this.client.publish(this.config.collectedTopic, JSON.stringify(payload));
    }
  },

  connect: function () {
    const { server, username, password, markedTopic } = this.config;
    this.client = mqtt.connect(server, { username, password });

    this.client.on("connect", () => {
      this.client.subscribe(markedTopic, (err) => {
        if (err) {
          console.error(`${this.name}: Abo auf ${markedTopic} fehlgeschlagen: ${err}`);
        }
      });
    });

    this.client.on("message", (topic, message) => {
      try {
        const marked = JSON.parse(message.toString() || "{}");
        this.marked = marked && typeof marked === "object" ? marked : {};
      } catch (error) {
        console.warn(`${this.name}: ungültige Nachricht auf ${topic}: ${message}`);
        return;
      }
      this.sendSocketNotification("MARKED_BINS", this.marked);
    });

    this.client.on("error", (error) => {
      console.error(`${this.name}: MQTT-Fehler: ${error.message}`);
    });
  },
});
