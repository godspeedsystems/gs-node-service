/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
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

if (config.has('jwt')) {
    initialize();
}