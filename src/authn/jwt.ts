/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import passport from 'passport';
import express from 'express';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import config from 'config';

export function initialize() {
  let jwtConfig: any = config.get('jwt');

  passport.use(
    new JwtStrategy({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ...jwtConfig,
      ignoreExpiration: true,
      jsonWebTokenOptions: {
        audience: jwtConfig.audience,
        issuer: jwtConfig.issuer,
      }
    },
      function (jwtPayload, done) {
        return done(null, jwtPayload);
      })
  );
}

export function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  return passport.authenticate('jwt', { session: false })(req, res, next);
}

