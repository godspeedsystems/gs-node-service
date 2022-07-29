import config from 'config';

import { logger } from './logger';
import { PlainObject } from './common';
import { config as appConfig } from './loader';

function substitute(value: string): any {
  try {
    if ((value as string).match(/<(.*?)%/)) {
      logger.debug('value before %s', value);

      let script = (value as string).replace(/"?<(.*?)%\s*(.*?)\s*%>"?/, '$2');
      //TODO: pass other context variables
      value = Function('config', 'mappings', 'return ' + script)(config, appConfig.app.mappings);
      logger.debug('value after %s', value);
    }
  } catch (ex) {
    //console.error(ex);
    logger.error(ex);
  }

  return value;
}

export default function compileScript(args: any) {
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
