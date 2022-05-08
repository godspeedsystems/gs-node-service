import Pino from 'pino';
import pinoDebug from 'pino-debug';
import config from 'config';

let log_level: string;
if (config.has('log_level')) {
  log_level = config.get('log_level');
} else {
  log_level = 'debug';
}

const logger: Pino.Logger = Pino({
  name: 'GS-logger',
  level: log_level
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
