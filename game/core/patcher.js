/* 
Blockverse 2 Mod Support Utils
================================================
This is a general purpose tool to patch the game in various ways and allow all content to be loaded *ONLY* using
patches rather than hardcoding. This ultimately makes Blockverse 2 an engine in some ways rather than a standard
game that depends on hardcoded content to boot.
*/

// Imports
import { version, STRICT_MOD_MODE } from './globals.js';

// Globals
const parse = JSON.parse;
const prefix_loc = '../../data/'; // Change me if minified
let mods = [];

// Mod Hooks
class ModHooks {
  
}

// Mod Utilities
class ModUtils {
  static parsePack(path) {
    let rawF; // Raw File Data

    // Getting Prefix Ready
    let e = `${prefix_loc}${path}/`;
    if (e.includes("//")) {
      e = e.replaceAll('//', '/');
    }
    
    // Fetching meta.json
    let l = `${e}meta.json`; // File Location
    const req = new XMLHttpRequest();
    req.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
         rawF = xhttp.responseText;
      }
    };
    
    req.open("GET", l, true);
    req.send();
      
    const raw_data = parse(rawF); // Raw Object Data
    let pack = {
      name: raw_data.name,
      author: raw_data.author,
      version: raw_data.pack_version,
      engine_version: raw_data.engine_version,
      blockdata: raw_data.blockdata_location,
      blockdata_done: false,
      exec: raw_data.init_script,
      exec_done: false,
      active: false,
    } // Formatted Data

    // Validation
    if (STRICT_MOD_MODE && pack.version != pack.engine_version) {
      console.error(`Could not load pack ${pack.name} due to an incompatible engine version.`);
      return null;
    }

    // Patching the Game
    if (blockdata !== undefined) {
      const r = new XMLHttpRequest();
      let file;
      req.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
         file = xhttp.responseText;
        }
      };
    
      req.open("GET", `${e}${pack.blockdata}`, true);
      req.send();

      // To-do: Merge Blockdata into the current array

      // Finish Up
      pack.blockdata_done = true;
    } else {
      pack.blockdata_done = true;
    }

    if (exec !== undefined) {
      // To-do: Expose a modding API
      const { start } = await import(`${e}${pack.exec}`);
      if (start == undefined) {
        console.warn('An exec script was defined but could not be loaded! (INVALID PATH/UNDEFINED)');
      } else {
        start(ModHooks); // Pass the ModHooks object to the mod
      }
      
      // Finish Up
      pack.exec_done = true;
    } else {
      pack.exec_done = true;
    }

    // Since we are still here, we can check if all tasks are done and push
    if (!pack.exec_done || !pack.blockdata_done) {
      throw "Unknown Mod Parsing Error";
    } else {
      pack.active = true;
      mods.push(pack);

      return true; // We use this as a success statement (code 1)
    }
  }
}

// Exports
export { ModUtils, ModHooks }