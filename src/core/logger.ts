import Pino from 'pino';
// import pinoDebug from 'pino-debug';

const logger: Pino.Logger = Pino({
  name: 'GS-logger'
});

/*
pinoDebug(logger, {
  auto: true, // default
  map: {
    'GS-server': 'info',
    'express:router': 'debug',
    '*': 'trace' // everything else - trace
  }
})
*/

export { logger };
