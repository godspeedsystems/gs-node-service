/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { logger } from "../../../core/logger";
import {GSStatus} from '../../../core/interfaces';
import { PlainObject } from "../../../core/common";

export default async function elasticgraph(args:{[key:string]:any;}) {
    logger.debug('com.gs.elasticgraph args: %o',args);
    
    const es = args.datasource.client;
    const method = args.config.method;
    const deep = args.config.deep || args.datasource.deep;
    const collect = args.config.collect || args.datasource.collect;
    let res: any;
    let status: any;
    let resData: PlainObject;

    // Check if deep feature is enabled. We have three cases here:
    // 1. deep=true If deep is true then it has collect within it by default.
    // 2. collect=true if deep is false and collect is true then just enable collect feature over native elasticsearch.
    // 3. If both deep and colect are not enabled then just call the native elasticsearch api.
    try {
        // TODO Response codes mapping w.r.t. methods
        if (deep) {
            res = await es.deep[method](args.data);
            status = 200;
            resData = res;
        } else if (collect) {
            res = await es[method].collect(args.data);
            status = res.statusCode || 200;
            resData = res;
        } else {
            res = await es[method](args.data);
            status = res.statusCode || 200;
            resData = res.body;
        }
    } catch (err:any) {
        logger.error('Caught exception %o', err.stack);
        return new GSStatus(false, 500, err.message, JSON.stringify(err.stack));
    }
    return new GSStatus(true, status, undefined, resData);
}
