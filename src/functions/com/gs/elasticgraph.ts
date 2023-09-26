/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { childLogger } from '../../../app';
import {GSStatus} from '../../../core/interfaces';
import { PlainObject } from "../../../core/common";
import { trace, Span, SpanStatusCode, SpanContext } from "@opentelemetry/api";

const tracer = trace.getTracer('name');


export default async function elasticgraph(args:{[key:string]:any;}) {
    let datastoreSpan: Span;
    childLogger.debug('com.gs.elasticgraph args.data: %o',args.data);
    
    const es = args.datasource.client;
    const method = args.config.method;
    const deep = args.config.deep || args.datasource.deep;
    const collect = args.config.collect || args.datasource.collect;
    let res: any;
    let status: any;
    let resData: PlainObject;

    // Start an elasticgraph span
    datastoreSpan = tracer.startSpan(`elasticgraph: ${args.datasource.gsName} ${args.data.index} ${method}`);

    const spanCtx: SpanContext = datastoreSpan.spanContext();
    datastoreSpan.setAttributes({
        'traceId': spanCtx.traceId,
        'spanId': spanCtx.spanId,
        'method': method,
        'index': args.data.index,
        'db.system': 'elasticgraph'
    });


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
            status = res?.statusCode || 200;
            resData = res;
        } else {
            res = await es[method](args.data);
            status = res?.statusCode || 200;
            resData = res.body;
        }
    } catch (err:any) {
        childLogger.error('Caught exception %o', err);
        datastoreSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message});
        datastoreSpan.setAttribute('status_code', 500);
        datastoreSpan.end();
        return new GSStatus(false, 500, err.message, err);
    }

    datastoreSpan.setAttribute('status_code', status);
    datastoreSpan.end();
    return new GSStatus(true, status, undefined, resData);
}
