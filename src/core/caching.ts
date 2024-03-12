import { GSContext, GSFunction } from './interfaces';
import { PlainObject } from './common';
import evaluateScript from './scriptRuntime';
import { logger } from '../logger';
import config from 'config';
import { GSCachingDataSource } from './_interfaces/sources';

export async function preChecksAndInvalidateCache(ctx: GSContext, caching: GSFunction, taskValue: any) {
    let cachingInstruction: PlainObject | null = null;
    let cachingDs: GSCachingDataSource;
    
    cachingInstruction = await evaluateScript(ctx, caching, taskValue);
    if (!cachingInstruction) {
      logger.error('Error in evaluating cachingInstruction %o', caching);
      throw new Error('Error in evaluating caching script');
    }
    const cachingDsName: string = cachingInstruction?.datasource || (config as any).caching;
    if (!cachingDsName) {
      ctx.childLogger.fatal( 'Set a non null caching datasource in config/default or in the caching instruction itself. Exiting.');
      process.exit(1);
    }
    cachingDs = ctx.datasources[cachingDsName];
    if (!cachingDs) {
      ctx.childLogger.fatal( 'Could not find a valid datasource by the name %s . Exiting', cachingDsName);
      process.exit(1);
    }
    if (cachingInstruction?.invalidate) {
        ctx.childLogger.debug('Invalidating cache for key %s', cachingInstruction?.invalidate);
        await cachingDs.del(cachingInstruction.invalidate);
    }

    return {
        ...cachingInstruction,
        "cachingDs": cachingDs
    };
}

export async function cacheBefore(cachingInstruction: PlainObject | null) {
    let status;
    const cachingDs: GSCachingDataSource = cachingInstruction?.cachingDs;

    if (cachingInstruction?.key) {
        // check in cache and return
        status = await cachingDs.get(cachingInstruction?.key);
    }
    return status;
}

export async function cacheAfter(ctx: GSContext, cachingInstruction: PlainObject | null, status: any) {
    const cachingDs: GSCachingDataSource = cachingInstruction?.cachingDs;

    if (cachingInstruction?.key) {
        if (status?.success || cachingInstruction.cache_on_failure) {
            ctx.childLogger.debug('Storing task result in cache for %s and value %o', cachingInstruction.key, status);
            await cachingDs.set(cachingInstruction.key, JSON.stringify(status), cachingInstruction.options);//{ EX: cachingInstruction.expires });
        }
    }
}
