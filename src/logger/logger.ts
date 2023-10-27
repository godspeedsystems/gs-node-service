/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import Pino from 'pino';
import config from 'config';

const configRedact = (config as any).redact || [];
let redactAttrs: Array<string> = [];
for (const redactAttr of configRedact) {
  if (redactAttr.match(/^\*\*/)) {
    const fieldName = redactAttr.replace(/^\*\*\./, '');
    redactAttrs.push(`${fieldName}`,
      `*.${fieldName}`,
      `*.*.${fieldName}`,
      `*.*.*.${fieldName}`,
      `*.*.*.*.${fieldName}`,
      `*.*.*.*.*.${fieldName}`,
      `*.*.*.*.*.*.${fieldName}`,
      `*.*.*.*.*.*.*.${fieldName}`,
      `*.*.*.*.*.*.*.*.${fieldName}`,
      `*.*.*.*.*.*.*.*.*.${fieldName}`
    );
  } else {
    redactAttrs.push(redactAttr);
  }
}

let logTarget: string;
if (process.env.OTEL_ENABLED == 'true' && process.env.NODE_ENV != 'dev') {
  logTarget = "../pino/pino-opentelemetry-transport.js";
} else {
  logTarget = "pino-pretty";
}

const logger: Pino.Logger = Pino({
  level: (config as any).log_level || 'info',
  transport: {
    target: logTarget,
    options: {
      destination: 1,
      Resource: {
        'service.name': process.env.OTEL_SERVICE_NAME || 'unknown_service:node',
        env: process.env.NODE_ENV
      }
    }
  },
  redact: {
    paths: redactAttrs,
    censor: '*****'
  }
});

export { logger };
