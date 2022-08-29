import Pino from 'pino';
import pinoDebug from 'pino-debug';
import config from 'config';

const transport = Pino.transport({
  target: '../pino/pino-opentelemetry-transport',
  options:  { 
              destination: 1, 
              Resource: { 'service.name': process.env.OTEL_SERVICE_NAME || 'unknown_service:node' } 
            }
});

const logger: Pino.Logger = Pino(transport);
logger.level = (config as any).log_level || 'debug';

pinoDebug(logger, {
  auto: true, // default
  map: {
    'express:router': 'debug',
    '*': 'trace' // everything else - trace
  }
});

export { logger };
