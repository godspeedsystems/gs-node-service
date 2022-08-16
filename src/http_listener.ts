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
import promBundle from 'express-prom-bundle';
import prometheusClient from 'prom-client';

export const register = new prometheusClient.Registry();

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
    if (req.path == '/metrics') {
        return next();
    } else {
        return passport.authenticate('jwt', { session: false })(req, res, next);
    }
  })
}

app.listen(port);

prometheusClient.collectDefaultMetrics({ register });
app.use(
  promBundle({
      autoregister: false,
      includeMethod: true,
      includeStatusCode: true,
      includePath: true,
      promRegistry: register,
  }),
);

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
