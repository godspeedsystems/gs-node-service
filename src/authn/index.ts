import config from "config";
import express from 'express';

import { authenticate, initialize } from "./jwt";

export default function authn(required: boolean) {
    return function(req: express.Request, res: express.Response,  next: express.NextFunction) {
        if (required) {
            return authenticate(req, res, next);
        }
        return next();
    };
}

if (config.get('jwt')) {
    initialize();
}