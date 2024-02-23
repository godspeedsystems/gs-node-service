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

function substitute(value: string, location: PlainObject): any {
  const initialStr = value;
  try {
    value = value.trim();    
    if (value.match(/<(.*?)%/) && value.match(/%>$/)) {

      let script = value.replace(/^<(.*?)%/, '').replace(/%>$/, '');
      //TODO: pass other context variables
      //@ts-ignore
      value = Function('config', 'mappings', 'return ' + script)(config, global.mappings);
      // logger.debug('value before %s value after %s', before, value);
    }
  } catch (ex: any) {
    logger.fatal(location, 'Caught exception in script compilation, script: %s compiled script %s. Error message %s\n error %o %o', initialStr, value, ex.message, ex, ex.stack);
    process.exit(1);
}

  return value;
}

export default function compileScript(args: any, location: PlainObject) {
  if (!args) {
    return args;
  }
  if (typeof (args) == 'object') {
    if (!Array.isArray(args)) {
      let out: PlainObject = {};
      for (let k in args) {
        out[k] = compileScript(args[k], location);
      }
      return out;
    } else {
      let out: [any] = <any>[];
      for (let k in <[any]>args) {
        out[k] = compileScript(args[k], location);
      }
      return out;
    }
  } else if (typeof (args) == 'string') {
    return substitute(args, location);
  }

  return args;
}
