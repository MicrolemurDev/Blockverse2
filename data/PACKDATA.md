## GameData Format Draft 1 (WIP)
GameData is loaded via JSON files which can (and should!) have JavaScript in ES6 Export Fomat in order to load data/events into the Blockverse 2 Engine. The format should be built in the following format:

```
data/
  [datapack name]/
    [optional] scripts/
      [INSERT SCRIPTS]
    [optional] textures/
      [optional] gui/
      [optional] blocks/
    meta.json  
```

However, all that is needed is a proper `meta.json` in order to load. But for readability, this is the prefered format of the data and it is used in the offical codebase.

### Metadata Supported
- `name`: A name to pass on to the engine **(REQUIRED!)**
- `pack_version`: A Version to display of the pack itself **(REQUIRED!)**
- `engine_version`: Version of the engine it is built for **(REQUIRED!)**
  - Please note that the engine can still try to load packs for old versions but it will give a warning!
- `author`: A Simple string to give the author of the pack **(REQUIRED!)**
- `blockdata_location`: If blocks want to be loaded you need to point to a `blocks.js` (see blocks.js Format). **(NEEDED FOR CUSTOM BLOCKS!)**
  - **Tip:** Assume the filesystem location is in the scope of the `meta.json` file location.
- `initScript`: Use this if you need to evaluate a script on load to add custom hooks to the game engine. (should have a named export `start` to load all required patches)
  - Be aware however that using custom hooks and modifying engine code is not recommended for compatibility purposes. *Only do this if you need to add new methods/know what you are doing!*

### blocks.js Format
Blocks should be put in an named export `blockData` with an array of objects. Data can include:
- `name`: Used to assign a name to the block. **(MANDATORY!)**
- `textures`: Used to define custom textures. If not defined, it will fallback to the texture assigned to the name of the block.
  - Example (Grass Block, Blockverse 2) `textures: ["dirt", "grassTop", "grassSide"],`
- `transparent`: A boolean value which determines if transparency should be calculated for the block (Clip Transparency, Color Transparency is not offically supported yet)
- `shadow`: A boolean value to determine if voxel shadows/AO should be casted from this block.