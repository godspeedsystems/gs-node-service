/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import Pino from 'pino';
import pinoDebug from 'pino-debug';
import config from 'config';

const logger: Pino.Logger = Pino({
  level: (config as any).log_level || 'debug',
  transport: {
    target: '../pino/pino-opentelemetry-transport',
    options:  { 
                destination: 1, 
                Resource: { 'service.name': process.env.OTEL_SERVICE_NAME || 'unknown_service:node' } 
              }
  },
  redact: {
    paths: (config as any).redact || [],
    censor: '*****'
  }
});

pinoDebug(logger, {
  auto: true, // default
  map: {
    'express:router': 'debug',
    '*': 'trace' // everything else - trace
  }
});

export { logger };
