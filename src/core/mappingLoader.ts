/*
 * You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
 * © 2022 Mindgrep Technologies Pvt Ltd
 */

import path from 'path';
import { PlainObject } from './common';
import iterate_yaml_directories from './configLoader';
import { compileScript } from './utils';
import config from 'config';
import { logger } from '../logger';
import fs from 'fs';


let mappings: PlainObject;

export default function loadMappings(mappingFolderPath?: string) {
  if (typeof mappings === 'undefined' && mappingFolderPath) {
    if (!fs.existsSync(mappingFolderPath)) {
      return {};
    }
    /*
      iterate_yaml_directories return the object after recussively iterating the directory, and keeping it's content
      inside the [directory name] key
      so we are taking the key, on the base path of mappingFolderPath, that's the actual mapping object
    */
    let _mappings = iterate_yaml_directories(mappingFolderPath)[path.basename(mappingFolderPath)];
    // logger.debug('Unevaluated mappings: %o', _mappings);
    const taskLocation = { mappingPath: mappingFolderPath };
    const mappingScript: Function = compileScript(_mappings, taskLocation);
    const evaluatedMappings = mappingScript(config, {}, {}, _mappings, {});
    logger.debug('Loaded mappings: %o', Object.keys(evaluatedMappings));
    mappings = evaluatedMappings;
    return mappings;
  } else {
    return mappings;
  }
};



// export default function loadMappings(mappingFolderPath: string) {
//   let mappings = iterate_yaml_directories(mappingFolderPath);
//   console.log('Loaded mappings: %o', mappings);
//   const mappingScript: Function = compileScript(mappings);
//   const evaluatedMappings = mappingScript(config, {}, {}, mappings, {});
//   console.log('evaluatedMappings: %o', evaluatedMappings);
//   return evaluatedMappings;
// }