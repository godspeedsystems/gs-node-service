import { logger } from './logger';
import config from 'config';
export default function (value: string): any {
  const originalValue: string = value;
  try {
    if ((value as string).match(/<(.*?)%/)) {
      value = (value as string).replace(/"?<(.*?)%\s*(.*?)\s*%>"?/, '$2');

      if (value.startsWith('config')) {
        logger.debug('value before %s', value);
        value = (value as string).replace(/\./g, '?.');
        logger.debug('value inter %s', value);
        value = Function('config', 'return ' + value)(config);
        logger.debug('value after %s', value);
        return value;
      }
    }
  } catch (ex) {
    //console.error(ex);
    logger.error(ex);
  }

  return originalValue;
}
