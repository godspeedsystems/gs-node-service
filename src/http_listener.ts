/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import express from 'express';
import bodyParser from 'body-parser';
import expressPinoLogger from 'express-pino-logger';
import swaggerUI from "swagger-ui-express";
import path from 'path';
import passport from 'passport';
import {Strategy as JwtStrategy, ExtractJwt} from 'passport-jwt';
import config  from 'config';
import { logger } from './core/logger';
import fileUpload from 'express-fileupload';
import { PROJECT_ROOT_DIRECTORY } from './core/utils';
import generateSchema from './api-specs/api-spec';
//import promBundle from 'express-prom-bundle';
import promMid from 'express-prometheus-middleware';
import { promClient } from './telemetry/monitoring';

//File Path for api-docs
const file =PROJECT_ROOT_DIRECTORY.split("/");
file.pop();

const loggerExpress = expressPinoLogger({
    logger: logger,
    autoLogging: true,
  });

const app:express.Express = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(loggerExpress);

const port = process.env.PORT || 3000;
app.use(fileUpload({
    useTempFiles: true,
    limits: { fileSize: 50 * 1024 * 1024 },
}));

if (config.has('jwt')) {
  let jwtConfig: any = config.get('jwt');

  passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    ...jwtConfig,
    ignoreExpiration: true,
    jsonWebTokenOptions: {
      audience: jwtConfig.audience,
      issuer: jwtConfig.issuer,
    }
  }, function(jwtPayload, done) {
      return done(null, {});
  }));  

  app.use(function(req, res, next) {
    if (req.path == '/metrics' || req.path == '/health') {
        return next();
    } else {
        return passport.authenticate('jwt', { session: false })(req, res, next);
    }
  });
}

app.listen(port);

//promClient.collectDefaultMetrics();
app.use(promMid({
  collectDefaultMetrics: true,
  requestDurationBuckets: [0.1, 0.5, 1, 1.5],
  requestLengthBuckets: [512, 1024, 5120, 10240, 51200, 102400],
  responseLengthBuckets: [512, 1024, 5120, 10240, 51200, 102400]
}));

const eventPath = path.resolve(PROJECT_ROOT_DIRECTORY + '/events');

generateSchema(eventPath)
  .then((schema) => {
    logger.debug("api-schema generated at /api-docs");
    app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(schema));
  })
  .catch((e) => {
    logger.error('Error in generating API schema %o', e);
    process.exit(1);
  });

logger.info('Node + Express REST API skeleton server started on port: %s', port);

export default app;

export let router = express.Router();
