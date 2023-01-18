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
        logger.error('Error in parsing script: %s',JSON.stringify(err.stack));
        ctx.exitWithStatus = new GSStatus(
            false,
            undefined,
            err.message,
            err.stack
        );
    }
}
