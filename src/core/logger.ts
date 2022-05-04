import pinoDebug from  'pino-debug'
import Pino from 'pino'

const logger: Pino.Logger = Pino({
  name: 'GS-logger'
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
