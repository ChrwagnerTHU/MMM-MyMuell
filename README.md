# MMM-MyMüllNotify


This a module for the [MagicMirror](https://github.com/MichMich/MagicMirror). It can display if on todays date a certain trash type is collected in Germany.
Only cities which use the MyMüll application are available with this module. 
Have a look [here](https://mymuell.jumomind.com/mmapp/loxone/lox.php?r=cities) if your city is supported.

## Installation

In terminal, go to your MagicMirror's Module folder:
```
cd ~/MagicMirror/modules
```

Clone this repository:
```
git clone https://github.com/ChrwagnerTHU/MMM-MyMüllNotify
```

## Updating

In terminal, go to the Module's folder and pull the latest version from GitHub:
```
cd ~/MagicMirror/modules/MMM-MyMüllNotify
git pull
```

## Configuration options

### Main config
|Option|Default|Description|
|---|---|---|
|`cityId`|""|ID of the city you want to display|
|`areaId`|""|ID of the area you want to display|
|`description`|false|Flag if further descriptions shall be displayed|


## Using the module

### Get CityID and AreaID

- Look [here](https://mymuell.jumomind.com/mmapp/loxone/lox.php?r=cities) to find your cities ID
- Look on the following link for your area ID `https://mymuell.jumomind.com/mmapp/api.php?r=streets&city_id=ID` where the ID at the end is your cities ID

### Update the `config.js`

To use this module, add it to the modules array in the `~/MagicMirror/config/config.js` file.

#### Example
```
    {
        module: 'MMM-MyMüllNotify',
        header: "Abfuhrkalender",
        position: 'top_left',
        config: {
            cityId: '62513',
            areaId: '355'
        }
    },
```

## Special Thanks
- [Michael Teeuw](https://github.com/MichMich) for creating the awesome [MagicMirror2](https://github.com/MichMich/MagicMirror/tree/develop) project that made this module possible.
