import pino from 'pino';
import { logger } from './logger';

let childLogger: pino.Logger;

const initilizeChildLogger = (options: pino.LoggerOptions) => {
  if (childLogger) {
    return childLogger;
  }

  childLogger = logger.child(options);
  return childLogger;
};

export {
  logger,
  childLogger,
  initilizeChildLogger
};
