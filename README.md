# MMM-MyMuell

`MMM-MyMuell` ist ein [MagicMirror2](https://github.com/MichMich/MagicMirror) Modul zur Anzeige von Abholterminen aus der MyMuell-API.

Das Modul zeigt:
- heutige Leerungen
- morgige Leerungen
- optional eine zusätzliche Beschreibungs-Spalte
- optional einen Hinweis `Mülltonne rausstellen!` über `schedule`

Nur Städte/Orte, die in MyMuell verfügbar sind, werden unterstützt.

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

Füge das Modul in `~/MagicMirror/config/config.js` hinzu:

```js
{
  module: "MMM-MyMuell",
  header: "Abfuhrkalender",
  position: "top_left",
  config: {
    cityId: "62513",
    areaId: "355",
    description: false,
    updateDataInterval: 0,
    updateInterval: 60 * 60 * 1000,
    schedule: []
  }
}
```

### Optionen

| Option | Standard | Beschreibung |
|---|---|---|
| `cityId` | `""` | ID der Stadt |
| `areaId` | `""` | ID des Bereichs/Straßenabschnitts |
| `description` | `false` | Zeigt zusätzliche Beschreibung pro Eintrag |
| `updateDataInterval` | `0` | Wochentag für Neuladen der API-Daten (`0 = Sonntag`, `1 = Montag`, ... `6 = Samstag`) |
| `updateInterval` | `60 * 60 * 1000` | Intervall für Modul-Update in Millisekunden (Standard: stündlich) |
| `schedule` | `[]` | Liste von Datumseinträgen im Format `YYYY-MM-DD`, für die der Hinweis `Mülltonne rausstellen!` angezeigt wird |

## City- und Area-ID finden

1. Stadt-ID über die MyMuell-Liste ermitteln:  
   https://mymuell.jumomind.com/mmapp/loxone/lox.php?r=cities
2. Bereich-ID anhand der Stadt-ID ermitteln:  
   `https://mymuell.jumomind.com/mmapp/api.php?r=streets&city_id=DEINE_STADT_ID`

## Hinweise

- Wenn keine Daten für heute oder morgen vorhanden sind, zeigt das Modul `Keine Leerungen geplant`.
- Während des Ladens zeigt das Modul `Lädt...`.

## Danksagung

- [Michael Teeuw](https://github.com/MichMich) für [MagicMirror2](https://github.com/MichMich/MagicMirror/tree/develop)
