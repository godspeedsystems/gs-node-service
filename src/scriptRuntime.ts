/**
 * Import all packages available in scripts of workflow
 */
import _ from 'lodash';

import * as plugins from "./plugins";
import { GSContext, GSStatus } from "./core/interfaces"; // eslint-disable-line
import { logger } from "./core/logger";

export function importAll(sourceScope: any, targetScope: any) {
    for (let name in sourceScope) {
        targetScope[name] = sourceScope[name];
    }
}

importAll(plugins, global);

/**
 * Can be called for gsFunction.args, gsFunction.on_error.transform and switch.condition
 * Input an be scalar or object
 */
export default async function evaluateScript(ctx: GSContext, script: Function) {

    logger.debug('before evaluateScript %s', script);
    
    if (!script) {
        return;
    }

    try {
        return script(ctx.config, ctx.inputs.data, ctx.outputs, ctx.mappings);
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