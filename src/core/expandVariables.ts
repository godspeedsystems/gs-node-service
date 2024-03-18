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
    if ((value as string).match(/<(.*?)%/)) {
      let script = (value as string).replace(/"?<(.*?)%\s*(.*?)\s*%>"?/, '$2');
      //TODO: pass other context variables

      if (! (script.match(/<(.*?)%/) && script.match(/%>/))) {
        //@ts-ignore
        value = Function('config', 'mappings', 'return ' + script)(config, global.mappings);
      }
    }
  } catch (ex: any) {
    if (initialStr.includes('inputs') || initialStr.includes('outputs')) {
      logger.info(location, 'Could not compile script containing `inputs` or `outputs` because they are available during runtime and not loadtime. if intended use of this script is during runtime you should ignore this message. Original script: %s. Compiled script %s. Error message %s', initialStr, value, ex.message);
    } else {
      logger.fatal(location, 'Caught exception in script compilation, script: %s compiled script %s. Error message %s\n error %o %o', initialStr, value, ex.message, ex, ex.stack);
      process.exit(1);
    }
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
