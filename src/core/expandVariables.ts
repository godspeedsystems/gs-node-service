import { logger } from './logger';
import config from 'config';
export default function (value: string): any {
  try {
    if ((value as string).match(/<(.*?)%/)) {
      logger.debug('value before %s', value);

      let script = (value as string).replace(/"?<(.*?)%\s*(.*?)\s*%>"?/, '$2');
      //TODO: pass other context variables
      value = Function('config', 'return ' + script)(config);
      logger.debug('value after %s', value);
    }
  } catch (ex) {
    //console.error(ex);
    logger.error(ex);
  }

  return value;
}
