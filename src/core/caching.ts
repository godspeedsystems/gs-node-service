import { GSContext, GSFunction } from './interfaces';
import { PlainObject } from './common';
import evaluateScript from './scriptRuntime';
import { logger } from '../logger';
import config from 'config';
import { GSCachingDataSource } from './_interfaces/sources';
import expandVariables from './expandVariables';

export function checkCachingDs(caching: any, location?: PlainObject) {
    //@ts-ignore
    const datasources = global.datasources;

    const cachingDsName: string = caching?.datasource || (config as any).caching;
    const evaluatedCachingDsName = expandVariables(cachingDsName, location!);
    if (!evaluatedCachingDsName) {
        logger.fatal(location, 'Exiting. Set a non null caching datasource in config/default or in the caching instruction itself %o', caching);
        process.exit(1);
    }
    const cachingDs: GSCachingDataSource = datasources[evaluatedCachingDsName];
    if (!cachingDs) {
        logger.fatal(location, 'Exiting. Could not find a valid datasource by the name %s in the caching instruction %o', cachingDsName, caching);
        process.exit(1);
    }
}

export async function evaluateCachingInstAndInvalidates(ctx: GSContext, caching: GSFunction, taskValue: any) {
    let cachingInstruction: PlainObject | null = null;   
    cachingInstruction = await evaluateScript(ctx, caching, taskValue);
    if (!cachingInstruction) {
        ctx.childLogger.error('Error in evaluating cachingInstruction %o', caching);
        throw new Error('Error in evaluating caching script');
    }
    const cachingDsName: string = cachingInstruction?.datasource || (config as any).caching;
    const cachingDs: GSCachingDataSource = ctx.datasources[cachingDsName];

    if (cachingInstruction?.invalidate) {
        ctx.childLogger.debug('Invalidating cache for key %s', cachingInstruction?.invalidate);
        await cachingDs.del(cachingInstruction.invalidate);
    }

    return {
        ...cachingInstruction,
        "cachingDs": cachingDs
    };
}

export async function fetchFromCache(cachingInstruction: PlainObject | null) {
    let status;
    const cachingDs: GSCachingDataSource = cachingInstruction?.cachingDs;

    if (cachingInstruction?.key) {
        // check in cache and return
        status = await cachingDs.get(cachingInstruction?.key);
    }
    return status;
}

export async function setInCache(ctx: GSContext, cachingInstruction: PlainObject | null, status: any) {
    const cachingDs: GSCachingDataSource = cachingInstruction?.cachingDs;

    if (cachingInstruction?.key) {
        if (status?.success || cachingInstruction.cache_on_failure) {
            ctx.childLogger.debug('Storing task result in cache for %s and value %o', cachingInstruction.key, status);
            await cachingDs.set(cachingInstruction.key, JSON.stringify(status), cachingInstruction.options);//{ EX: cachingInstruction.expires });
        }
    }
}
