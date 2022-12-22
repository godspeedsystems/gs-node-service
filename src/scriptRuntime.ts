/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
/**
 * Import all packages available in scripts of workflow
 */
import _ from 'lodash';

import { GSContext, GSStatus } from "./core/interfaces"; // eslint-disable-line
import { logger } from "./core/logger";

export function importAll(sourceScope: any, targetScope: any) {
    for (let name in sourceScope) {
        targetScope[name] = sourceScope[name];
    }
}

import * as fs from 'fs';
import * as assert from 'assert'
import * as buffer from 'buffer'
import * as child_process from 'child_process'
import * as cluster from 'cluster'
import * as crypto from 'crypto'
import * as dgram from 'dgram'
import * as dns from 'dns'
import * as events from 'events'
import * as http from 'http'
import * as https from 'https'
import * as net from 'net'
import * as os from 'os'
import * as path from 'path'
import * as querystring from 'querystring'
import * as readline from 'readline'
import * as stream from 'stream'
import * as string_decoder from 'string_decoder'
import * as timers from 'timers'
import * as tls from 'tls'
import * as url from 'url'
import * as util from 'util'
import * as zlib from 'zlib'

/**
 * Can be called for gsFunction.args, gsFunction.on_error.transform and switch.condition
 * Input an be scalar or object
 */
export default async function evaluateScript(ctx: GSContext, script: Function, taskValue?: any) {

    logger.debug('before evaluateScript %s', script);

    if (!script) {
        return;
    }

    try {
        return script(ctx.config, ctx.inputs.data, ctx.outputs, ctx.mappings, taskValue);
    } catch (err: any) {
        logger.error('Error in parsing script: %o',err);
        ctx.exitWithStatus = new GSStatus(
            false,
            undefined,
            err.message,
            err.stack
        );
    }
}
