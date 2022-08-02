import {GSStatus} from '../../../core/interfaces';
import { logger } from '../../../core/logger';
import { trace } from "@opentelemetry/api";
import { datastoreCounter, datastoreHistogram } from '../../../telemetry/monitoring';
const tracer = trace.getTracer('name');

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
  const [entityType, method] = args.config.method.split('.');
  let prismaMethod = ds.client[entityType][method];

  // Start a datastore span
  const datastoreSpan = tracer.startSpan(`datastore: ${args.datasource.gsName} ${entityType} ${method}`);
  datastoreSpan.setAttribute('method', method);
  datastoreSpan.setAttribute('model', entityType);
  datastoreSpan.setAttribute('db.system', 'prisma');

  // Record metrics to export for datastore
  const attributes = { hostname: process.env.HOSTNAME, datastore: args.datasource.gsName, model: entityType, method: method };
  datastoreCounter.add(1, attributes);
  datastoreHistogram.record(Math.random(), attributes);

  if (!prismaMethod) { //Oops!
    
    //Check whether the entityType specified is wrong or the method
    if (!ds.client[entityType]) {
      datastoreSpan.end();
      return new GSStatus(false, 400, `Invalid entity type "${entityType}" in query`);
    }
    //If not the entity type, the method specified must be wrong.
    datastoreSpan.end();
    return new GSStatus(false, 500, `Invalid CRUD method "${entityType}" "${method}" called`);
  }
  try {
    const res = await prismaMethod.bind(ds.client)(args.data);
    datastoreSpan.end();
    return new GSStatus(true, responseCode(method), undefined, res);
  } catch (err: any) {
    //TODO: better check for error codes. Return 500 for server side error. 40X for client errors.
    datastoreSpan.end();
    return new GSStatus(false, 400, err.message || 'Error in query!', JSON.stringify(err.stack));
  }
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
