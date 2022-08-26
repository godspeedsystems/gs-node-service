
import passport from 'passport';
import express from 'express';

import {Strategy as JwtStrategy, ExtractJwt} from 'passport-jwt';
import config  from 'config';

export function initialize() {
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
}

export function authenticate(req: express.Request, res: express.Response,  next: express.NextFunction) {
    return passport.authenticate('jwt', { session: false })(req, res, next);
}

