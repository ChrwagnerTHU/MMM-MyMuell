# MMM-MyMuell

`MMM-MyMuell` ist ein [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror) Modul zur Anzeige von Abholterminen der Müllabfuhr.

Das Modul zeigt:

- heutige Leerungen
- morgige Leerungen
- optional eine zusätzliche Beschreibungs-Spalte
- optional einen Hinweis `Mülltonne rausstellen!` über `schedule`

Jede Abfallart wird mit dem Farbcode dargestellt, den der jeweilige Entsorger für sie vorsieht.

## Unterstützte Datenquellen

Das Modul kann seine Termine aus zwei verschiedenen Systemen beziehen. Welches für dich gilt, hängt davon ab, welchen Dienstleister dein Entsorgungsbetrieb einsetzt.

| `provider` | System | Passt für dich, wenn … |
|---|---|---|
| `jumomind` | [MyMüll](https://www.mymuell.de/) (jumomind) | dein Entsorger die App „MyMüll“ anbietet |
| `awido` | [AWIDO](https://www.awido-online.de/) (Cube Four) | dein Entsorger eine AWIDO-basierte App oder einen AWIDO-Online-Kalender anbietet |

> **Hinweis:** Manche Entsorger sind von MyMüll zu AWIDO gewechselt. Die Entsorgungsbetriebe der Stadt Ulm (EBU) haben MyMüll zum 30.06.2026 durch die App „EBU AbfallPilot“ (AWIDO) ersetzt. Wenn dein Modul plötzlich dauerhaft `Keine Leerungen geplant` anzeigt, lohnt sich ein Blick darauf, ob dein Entsorger den Anbieter gewechselt hat.

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/ChrwagnerTHU/MMM-MyMuell
```

## Update

```bash
cd ~/MagicMirror/modules/MMM-MyMuell
git pull
```

## Konfiguration

Füge das Modul in `~/MagicMirror/config/config.js` hinzu.

### Beispiel für `provider: "awido"`

```js
{
  module: "MMM-MyMuell",
  header: "Abfuhrkalender",
  position: "top_left",
  config: {
    provider: "awido",
    client: "ebu",
    oid: "82cdeb64-3087-0305-76cb-05c12c073f6d",
    description: false,
    updateDataInterval: 0,
    updateInterval: 60 * 60 * 1000,
    schedule: []
  }
}
```

### Beispiel für `provider: "jumomind"`

```js
{
  module: "MMM-MyMuell",
  header: "Abfuhrkalender",
  position: "top_left",
  config: {
    provider: "jumomind",
    cityId: "12345",
    areaId: "678",
    description: false,
    updateDataInterval: 0,
    updateInterval: 60 * 60 * 1000,
    schedule: []
  }
}
```

### Optionen

**Allgemein**

| Option | Standard | Beschreibung |
|---|---|---|
| `provider` | `"jumomind"` | Datenquelle: `"jumomind"` oder `"awido"` |
| `description` | `false` | Zeigt eine zusätzliche Spalte mit der Beschreibung des Termins |
| `updateDataInterval` | `0` | Wochentag, an dem die Daten neu von der API geladen werden (`0 = Sonntag`, `1 = Montag`, … `6 = Samstag`) |
| `updateInterval` | `60 * 60 * 1000` | Intervall für das Modul-Update in Millisekunden (Standard: stündlich) |
| `schedule` | `[]` | Liste von Datumseinträgen im Format `YYYY-MM-DD`, an denen der Hinweis `Mülltonne rausstellen!` erscheint |

**Nur für `provider: "jumomind"`**

| Option | Standard | Beschreibung |
|---|---|---|
| `cityId` | `""` | ID der Stadt |
| `areaId` | `""` | ID des Bereichs bzw. Straßenabschnitts |

**Nur für `provider: "awido"`**

| Option | Standard | Beschreibung |
|---|---|---|
| `client` | `""` | Mandantenkürzel des Entsorgers (z. B. `"ebu"` für die EBU Ulm) |
| `oid` | `""` | ID deiner Adresse (Straße oder Hausnummer) |
| `includeSpecialEvents` | `false` | Zeigt zusätzlich Sondertermine wie ReparaturCafé, WarenTauschTage oder Putzete an |

## Konfigurationswerte ermitteln

Alle hier genannten URLs kannst du einfach im Browser aufrufen — sie brauchen keinen API-Schlüssel und liefern JSON, das du mit `Strg + F` durchsuchen kannst. Wer lieber im Terminal arbeitet, nutzt dieselben URLs mit `curl`.

### Für `provider: "jumomind"`

**Schritt 1 — `cityId` herausfinden**

Rufe die Liste aller Städte auf:

```
https://mymuell.jumomind.com/mmapp/loxone/lox.php?r=cities
```

Suche deinen Ort und notiere den Wert von `id`:

```json
{"name":"Musterstadt","id":12345,"area_id":0,"has_streets":true}
```

Steht bei deinem Ort `"has_streets":false`, gibt es dort keine Straßenauswahl. Dann ist der bei der Stadt angegebene `area_id` bereits dein `areaId` und du kannst Schritt 2 überspringen.

**Schritt 2 — `areaId` herausfinden**

Rufe die Straßenliste deiner Stadt auf und ersetze `DEINE_STADT_ID` durch die eben notierte `id`:

```
https://mymuell.jumomind.com/mmapp/api.php?r=streets&city_id=DEINE_STADT_ID
```

Suche deine Straße und notiere den Wert von `area_id` (**nicht** `id` — `id` ist die Straße, `area_id` der Abfuhrbezirk):

```json
{"name":"Musterweg","id":"372642","area_id":"678","street_comment":"Bezirk7"}
```

**Schritt 3 — prüfen**

Mit beiden Werten liefert diese URL deine Termine:

```
https://mymuell.jumomind.com/mmapp/api.php?r=dates&city_id=DEINE_STADT_ID&area_id=DEINE_AREA_ID
```

Kommt hier `[]` zurück, sind die Werte falsch — oder dein Entsorger liefert keine Daten mehr an MyMüll (siehe Hinweis oben).

### Für `provider: "awido"`

**Schritt 1 — `client` (Mandantenkürzel) herausfinden**

Öffne die Abfuhrkalender-Seite deines Entsorgers und schau dir den Seitenquelltext an (`Strg + U`). Der Online-Kalender wird als iframe eingebunden, und darin steckt das Mandantenkürzel:

```html
<iframe class="awido v3 kalender" src="https://portal.awido.de/Customer/ebu/v3/Calendar2.aspx">
```

Hier ist `ebu` der gesuchte Wert. Die URL kann auch `https://awido.cubefour.de/Customer/<client>/…` lauten — das Kürzel steht immer direkt hinter `/Customer/`.

Alternativ findest du eine gepflegte Liste von über 70 AWIDO-Mandanten in der Dokumentation des Home-Assistant-Projekts [waste_collection_schedule](https://github.com/mampfes/hacs_waste_collection_schedule/blob/master/doc/source/awido_de.md) — dort in der Spalte `customer`.

**Schritt 2 — ID deines Ortes**

Ersetze `DEIN_CLIENT` durch dein Mandantenkürzel:

```
https://awido.cubefour.de/WebServices/Awido.Service.svc/secure/getPlaces/client=DEIN_CLIENT
```

Notiere den `key` deines Ortes:

```json
[{"key":"00000000-0000-0000-1000-000000000001","value":"Ulm"}]
```

Bei Entsorgern, die nur eine einzige Stadt betreuen, steht hier auch nur ein Eintrag.

**Schritt 3 — `oid` deiner Straße**

Ersetze `ORT_KEY` durch den `key` aus Schritt 2:

```
https://awido.cubefour.de/WebServices/Awido.Service.svc/secure/getGroupedStreets/ORT_KEY?client=DEIN_CLIENT
```

Suche deine Straße und notiere ihren `key` — das ist deine `oid`:

```json
{"key":"82cdeb64-3087-0305-76cb-05c12c073f6d","value":"Abteistraße"}
```

> **Achtung:** Bei `getPlaces` gehört `client=` mit einem Schrägstrich in den Pfad, bei allen anderen Aufrufen mit einem Fragezeichen als Parameter dahinter. Ein `404` deutet meist auf genau diese Verwechslung hin.

**Schritt 4 — Hausnummer (nur wenn nötig)**

In manchen Straßen werden verschiedene Hausnummern an unterschiedlichen Tagen abgeholt. Prüfe das mit der `oid` aus Schritt 3:

```
https://awido.cubefour.de/WebServices/Awido.Service.svc/secure/getStreetAddons/DEINE_OID?client=DEIN_CLIENT
```

Kommt nur ein einziger Eintrag mit leerem `value` zurück, gibt es keine Unterteilung und du bleibst bei der `oid` aus Schritt 3:

```json
[{"key":"82cdeb64-3087-0305-76cb-05c12c073f6d","value":""}]
```

Erscheinen dagegen mehrere Einträge mit Hausnummernbereichen, nimm den `key` des Eintrags, der zu deiner Adresse passt, als `oid`.

**Schritt 5 — prüfen**

Diese URL liefert deinen kompletten Abfuhrkalender:

```
https://awido.cubefour.de/WebServices/Awido.Service.svc/secure/getData/DEINE_OID?fractions=&client=DEIN_CLIENT
```

Unter `fracts` stehen die Abfallarten mit Namen und Farben, unter `calendar` die Termine. `dt` ist das Datum, `fr` enthält die Kürzel der an diesem Tag abgeholten Abfallarten:

```json
{"ad":["Ulm, Abteistraße"],"dt":"20260105","fr":["GS"]}
```

## Hinweise

- Ein Aufruf liefert bei AWIDO den Kalender des gesamten laufenden Jahres. Häufigeres Neuladen als einmal pro Woche bringt deshalb nichts — `updateDataInterval` genügt völlig.
- AWIDO mischt Sondertermine (ReparaturCafé, WarenTauschTage, Putzete, Veranstaltungen) in denselben Kalender wie die Abfuhrtermine. Das Modul blendet sie standardmäßig aus; mit `includeSpecialEvents: true` erscheinen sie zusätzlich.
- Wenn keine Daten für heute oder morgen vorliegen, zeigt das Modul `Keine Leerungen geplant`.
- Während des Ladens zeigt das Modul `Lädt...`.
- Bei einer fehlerhaften Konfiguration zeigt das Modul den Grund direkt an, z. B. `client und oid müssen gesetzt sein`. Details stehen in der Entwicklerkonsole des MagicMirror.

## Danksagung

- [Michael Teeuw](https://github.com/MichMich) für [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror)
- [mampfes/hacs_waste_collection_schedule](https://github.com/mampfes/hacs_waste_collection_schedule) für die Dokumentation der AWIDO-Endpunkte und die Mandantenliste
