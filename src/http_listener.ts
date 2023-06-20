/*
 * You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
 * © 2022 Mindgrep Technologies Pvt Ltd
 */
import express from 'express';
import bodyParser from 'body-parser';
import expressPinoLogger from 'express-pino-logger';
import swaggerUI from 'swagger-ui-express';
import path from 'path';
import { logger } from './core/logger';
import fileUpload from 'express-fileupload';
import { PROJECT_ROOT_DIRECTORY } from './core/utils';
import generateSchema from './api-specs/api-spec';
import promMid from '@mindgrep/express-prometheus-middleware';
import middlewares from './middlewares';

//File Path for api-docs
const file = PROJECT_ROOT_DIRECTORY.split('/');
file.pop();

// @ts-ignore
const loggerExpress = expressPinoLogger({
  // @ts-ignore
  logger: logger,
  autoLogging: true,
});

const app: express.Express = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(loggerExpress);

try {
  for (const middleware of middlewares) {
    app.use(middleware);
  }  
} catch(err: any) {
  logger.error('Caught exception in initializing middlwares: %o', err.stack);
}

const port = process.env.PORT || 3000;
app.use(
  fileUpload({
    useTempFiles: true,
    limits: { fileSize: 50 * 1024 * 1024 },
  })
);

app.listen(port);

app.use(
  promMid({
    collectDefaultMetrics: true,
    requestDurationBuckets: [0.1, 0.5, 1, 1.5],
    requestLengthBuckets: [512, 1024, 5120, 10240, 51200, 102400],
    responseLengthBuckets: [512, 1024, 5120, 10240, 51200, 102400],
  })
);

const eventPath = path.resolve(PROJECT_ROOT_DIRECTORY + '/events');
const definitionsPath = path.resolve(PROJECT_ROOT_DIRECTORY + '/definitions');

generateSchema(eventPath, definitionsPath)
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
