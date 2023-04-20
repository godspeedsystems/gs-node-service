/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import config from 'config';

import { logger } from './logger';
import { PlainObject } from './common';
import loadMappings from './mappingLoader';

const mappings = loadMappings();

function substitute(value: string): any {
  try {
    if ((value as string).match(/<(.*?)%/)) {
      logger.debug('value before %s', value);

      let script = (value as string).replace(/"?<(.*?)%\s*(.*?)\s*%>"?/, '$2');
      //TODO: pass other context variables
      value = Function('config', 'mappings', 'return ' + script)(config, mappings);
      logger.debug('value after %s', value);
    }
  } catch (ex) {
    //console.error(ex);
  }

  return value;
}

export default function compileScript(args: any) {
  if (!args) {
    return args;
  }
  if (typeof(args) == 'object') {
    if (!Array.isArray(args)) {
        let out: PlainObject = {};
        for (let k in args) {
          out[k] = compileScript(args[k]);
        }
        return out;
    } else {
        let out:[any] = <any>[];
        for (let k in <[any]>args) {
          out[k] = compileScript(args[k]);
        }
        return out;
    }
  } else if (typeof(args) == 'string') {
    return substitute(args);
  }

  return args;
}
