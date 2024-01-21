/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import Pino from 'pino';
//@ts-ignore
import pinoDebug from 'pino-debug';
import config from 'config';

const configRedact = (config as any).redact || [];
let redactAttrs: Array<string> = [];
for (const redactAttr of configRedact) {
    if (redactAttr.match(/^\*\*/)) {
      const fieldName = redactAttr.replace(/^\*\*\./, '');
      redactAttrs.push(`${fieldName}`, `*.${fieldName}`, `*.*.${fieldName}`, `*.*.*.${fieldName}`, `*.*.*.*.${fieldName}`, `*.*.*.*.*.${fieldName}`,
        `*.*.*.*.*.*.${fieldName}`, `*.*.*.*.*.*.*.${fieldName}`, `*.*.*.*.*.*.*.*.${fieldName}`, `*.*.*.*.*.*.*.*.*.${fieldName}`
      );
  } else {
      redactAttrs.push(redactAttr);
    }
}

let logger: Pino.Logger = Pino({
  level: (config as any).log_level || 'debug',
  transport: {
    target: '../pino/pino-opentelemetry-transport',
    options:  { 
                destination: 1, 
                Resource: { 'service.name': process.env.OTEL_SERVICE_NAME || 'unknown_service:node',
                env: process.env.NODE_ENV } 
              }
  },
  redact: {
    paths: redactAttrs,
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



function loggerFn(logger){
  ['info','debug','error','fatal'].forEach((val) =>{
    const method = logger[val];
    logger[val] = function(str){
      try{
        method.bind(logger)(str);
      }catch(e){
        console.log(`Pino: error executing ${val} {${e.message}}`);
        console.log(`Printing original error log arguments: ${str}`);
      }
    };
  });
  return logger;
}

logger = loggerFn(logger);

var childFn = logger.child.bind(logger);

logger.child = function (bindings,options){
  return loggerFn(childFn(bindings,options));
};

export { logger };
