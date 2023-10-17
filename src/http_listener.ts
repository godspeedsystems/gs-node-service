/*
 * You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
 * © 2022 Mindgrep Technologies Pvt Ltd
 */
import express from 'express';
import bodyParser from 'body-parser';
import pinoHttp from 'pino-http';
import swaggerUI from 'swagger-ui-express';
import path from 'path';
import config from 'config';
import Prometheus from 'prom-client';
import fileUpload from 'express-fileupload';
//@ts-ignore
import promMid from '@mindgrep/express-prometheus-middleware';
import { logger } from './core/logger';
import { PROJECT_ROOT_DIRECTORY } from './core/utils';
import generateSchema from './api-specs/api-spec';
import middlewares from './middlewares';

//File Path for api-docs
const file = PROJECT_ROOT_DIRECTORY.split('/');
file.pop();

const loggerExpress = pinoHttp({
  logger: logger,
  autoLogging: true,
});

const app: express.Express = express();

//@ts-ignore
const request_body_limit = config.request_body_limit || 50 * 1024 * 1024;
//@ts-ignore
const file_size_limit = config.file_size_limit || 50 * 1024 * 1024;

app.use(bodyParser.urlencoded({ extended: true, limit: request_body_limit }));
app.use((req,res,next) => {
  bodyParser.json({ limit: request_body_limit })(req,res,err =>{
    if (err) {
      logger.error('Bad request: %o', err.stack);
      return res.status(400).send(err.message); // Bad request
    } 
    next();
  });
});
app.use(loggerExpress);

try {
  for (const middleware of middlewares) {
    app.use(middleware);
  }
} catch (err: any) {
  logger.error('Caught exception in initializing middlwares: %o', err.stack);
}

const port = process.env.PORT || 3000;
app.use(
  fileUpload({
    useTempFiles: true,
    //@ts-ignore
    limits: { fileSize: file_size_limit },
  })
);

app.listen(port);

app.use(
  promMid({
    collectDefaultMetrics: true,
    requestDurationBuckets: Prometheus.exponentialBuckets(0.2, 3, 6),
    requestLengthBuckets: Prometheus.exponentialBuckets(512, 2, 10),
    responseLengthBuckets: Prometheus.exponentialBuckets(512, 2, 10),
  })
);


const eventPath = path.resolve(PROJECT_ROOT_DIRECTORY + '/events');
const definitionsPath = path.resolve(PROJECT_ROOT_DIRECTORY + '/definitions');
const configPath = path.resolve(PROJECT_ROOT_DIRECTORY + '/config');

generateSchema(eventPath, definitionsPath, configPath)
  .then((schema) => {
    logger.debug('api-schema generated at /api-docs');
    app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(schema));
  })
  .catch((e) => {
    logger.error('Error in generating API schema %o', e);
    process.exit(1);
  });

logger.info(
  'Node + Express REST API skeleton server started on port: %s',
  port
);

export default app;

export let router = express.Router();
