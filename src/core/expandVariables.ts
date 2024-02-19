/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import config from 'config';
import { PlainObject } from './common';
import loadMappings from './mappingLoader';
import { logger } from '../logger';

//@ts-ignore
const mappings = global.mappings;

function substitute(value: string): any {
  try {
    if ((value as string).match(/<(.*?)%/)) {
      logger.debug('value before %s', value);

      let script = (value as string).replace(/"?<(.*?)%\s*(.*?)\s*%>"?/, '$2');
      //TODO: pass other context variables
      //@ts-ignore
      value = Function('config', 'mappings', 'return ' + script)(config, global.mappings);
      logger.debug('value after %s', value);
    }
  } catch (ex) {
    logger.error('Error in substituting script %o', ex);
  }

  return value;
}

export default function compileScript(args: any) {
  if (!args) {
    return args;
  }
  if (typeof (args) == 'object') {
    if (!Array.isArray(args)) {
      let out: PlainObject = {};
      for (let k in args) {
        out[k] = compileScript(args[k]);
      }
      return out;
    } else {
      let out: [any] = <any>[];
      for (let k in <[any]>args) {
        out[k] = compileScript(args[k]);
      }
      return out;
    }
  } else if (typeof (args) == 'string') {
    return substitute(args);
  }

  return args;
}
