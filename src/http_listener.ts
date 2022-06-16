import express from 'express';
import bodyParser from 'body-parser';
import expressPinoLogger from 'express-pino-logger';
import swaggerUI from "swagger-ui-express";
import path from 'path';
import passport from 'passport';
import {Strategy as JwtStrategy, ExtractJwt} from 'passport-jwt';
import config  from 'config';
import jwt from 'jsonwebtoken';

import { logger } from './core/logger';
import fileUpload from 'express-fileupload';
import { PROJECT_ROOT_DIRECTORY } from './core/utils';
import generateSchema from './api-specs/api-spec';
const { countAllRequests } = require("./telemetry/monitoring");

const loggerExpress = expressPinoLogger({
    logger: logger,
    autoLogging: true,
  });

const app:express.Express = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(countAllRequests());
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

  app.use(passport.authenticate('jwt', { session: false }));
}

app.listen(port);

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
