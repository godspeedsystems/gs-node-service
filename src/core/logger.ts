import Pino from 'pino';
import pinoDebug from 'pino-debug';
import config from 'config';

const logger: Pino.Logger = Pino({
  name: 'GS-logger',
  level: config.pino.level || 'debug'
});

pinoDebug(logger, {
  auto: true, // default
  map: {
    'GS-server': 'info',
    'express:router': 'debug',
    '*': 'trace' // everything else - trace
  }
})

export { logger };
