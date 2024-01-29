/*
 * You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
 * © 2022 Mindgrep Technologies Pvt Ltd
 */

import path from 'path';
import { PlainObject } from './common';
import iterate_yaml_directories from './configLoader';
import { logger } from '../logger';
import fs from 'fs';
import expandVariables from './expandVariables';


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
    logger.debug('Unevaluated mappings: %o', _mappings);
    const evaluatedMappings = expandVariables(_mappings);
    logger.debug('Evaluated mappings: %o', evaluatedMappings);
    mappings = evaluatedMappings;
    return mappings;
  } else {
    return mappings;
  }
};
