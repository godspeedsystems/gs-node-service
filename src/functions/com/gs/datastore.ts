import {GSStatus} from '../../../core/interfaces';
import { logger } from '../../../core/logger';
import { trace, Span, SpanStatusCode } from "@opentelemetry/api";
import { datastoreCounter, datastoreHistogram } from '../../../telemetry/monitoring';
import { PlainObject } from '../../../core/common';

const tracer = trace.getTracer('name');
let datastoreSpan: Span;

/**
 * 
 * @param args 
 * datasource: mongo1, mongo2 
 * config.method: Prisma methods (user.create, user.findMany)
 * data: arguments specific to the prisma method being invoked
 */
export default async function(args:{[key:string]:any;}) {
  logger.debug('args %o', args.data);
  
  const ds = args.datasource;
  let prismaMethod: any; let status_message: string; 

  const [entityType, method] = args.config.method.split('.');

  // Start a datastore span
  datastoreSpan = tracer.startSpan(`datastore: ${args.datasource.gsName} ${entityType} ${method}`);
  datastoreSpan.setAttribute('method', method);
  datastoreSpan.setAttribute('model', entityType);
  datastoreSpan.setAttribute('db.system', 'prisma');

  // Record metrics to export for datastore
  const attributes: PlainObject = { hostname: process.env.HOSTNAME, datastore: args.datasource.gsName, model: entityType, method: method };
  datastoreCounter.add(1, attributes);
  datastoreHistogram.record(Math.random(), attributes);

  try {
    prismaMethod = ds.client[entityType][method];
  } catch (err:any) {
    if (!prismaMethod) { //Oops!
      logger.error(err);
      //Check whether the entityType specified is wrong or the method
      if (!ds.client[entityType]) {
        attributes.status_code = 400;
        status_message = `Invalid entity type "${entityType}" in query`;
        datastoreSpan.setStatus({ code: SpanStatusCode.ERROR, message: status_message});
        cleanupTracesMetrics(attributes);
        return new GSStatus(false, attributes.status_code, undefined, status_message);
      }
      //If not the entity type, the method specified must be wrong.
      attributes.status_code = 500;
      status_message = `Invalid CRUD method "${entityType}" "${method}" called`;
      datastoreSpan.setStatus({ code: SpanStatusCode.ERROR, message: status_message});
      cleanupTracesMetrics(attributes);
      return new GSStatus(false, attributes.status_code, undefined, status_message);
    }  
  }

  try {
    const res = await prismaMethod.bind(ds.client)(args.data);
    attributes.status_code = responseCode(method);
    cleanupTracesMetrics(attributes);
    return new GSStatus(true, attributes.status_code, undefined, res);
  } catch (err: any) {
    //TODO: better check for error codes. Return 500 for server side error. 40X for client errors.
    attributes.status_code = 400;
    status_message = err.message || 'Error in query!';
    datastoreSpan.setStatus({ code: SpanStatusCode.ERROR, message: status_message});
    cleanupTracesMetrics(attributes);
    return new GSStatus(false, attributes.status_code, status_message, JSON.stringify(err.stack));
  }

}

function cleanupTracesMetrics(attributes: PlainObject) {
  datastoreSpan.setAttribute('status_code', attributes.status_code);
  datastoreSpan.end();
  datastoreCounter.add(1, attributes);
  datastoreHistogram.record(Math.random(), attributes);
}

function responseCode (method: string): number {
  return response_codes[method] || 200;
}

const response_codes: {[key: string]: number} = {
  find: 200,
  findFirst: 200,
  findUnique: 200,
  findMany: 200,
  create: 201,
  createMany: 201,
  update: 204,
  updateMany: 204,
  upsert: 201,
  delete: 202,
  deleteMany: 202,
  count: 200,
  aggregate: 200,
  groupBy: 200,
};
