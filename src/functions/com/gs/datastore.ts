/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import {GSStatus} from '../../../core/interfaces';
import { childLogger } from '../../../app';
import { trace, Span, SpanStatusCode, SpanContext } from "@opentelemetry/api";
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
  childLogger.debug('args %o', args.data);
  
  const ds = args.datasource;
  let prismaMethod: any; let status_message: string;
  let attributes: PlainObject; 
  let entityType: any, method: any;

  if (args.config.method == '$transaction') {
    let transData: any = [];
    method = '$transaction';
    startDatastoreSpan(args.datasource.gsName, entityType, method);
    
    // Record attributes to export for datastore
    attributes = { hostname: process.env.HOSTNAME, datastore: args.datasource.gsName, method: method };

    try {  
      prismaMethod = ds.client[method];
  
      if (!prismaMethod) { //Oops!
        //If not the entity type, the method specified must be wrong.
        attributes.status_code = 500;
        status_message = `Invalid method "${method}" called`;
        datastoreSpan.setStatus({ code: SpanStatusCode.ERROR, message: status_message});
        cleanupTraces(attributes);
        return new GSStatus(false, attributes.status_code, undefined, status_message);
      }  
    } catch (err:any) {
      childLogger.error('Caught exception %o', err.stack);
      attributes.status_code = 400;
      status_message = err.message || 'Error in getting prisma method from client!';
      datastoreSpan.setStatus({ code: SpanStatusCode.ERROR, message: status_message});
      cleanupTraces(attributes);
      return new GSStatus(false, attributes.status_code, status_message, JSON.stringify(err.stack));
    }

    // transData = [
    //   ds.client.CustomerJourney.findMany(args.data),
    //   ds.client.CustomerJourney.count()
    // ];

    /* Sample args.data in case method is $transaction
    args.data = {
      datasource: config.database.name,
      data: [
        {
          data: {
            where: inputs.body.request.filter,
            select: inputs.body.request.select_params,
            orderBy: inputs.body.request.order_by,
            include: inputs.body.request.include,
            skip: inputs.body.request.skip,
            take: inputs.body.request.take,
          },
          config: {
            method: "CustomerJourney.findMany"
          }
        },
        {
          data: {
            where: inputs.body.request.filter
          },
          config: {
            method: "CustomerJourney.count"
          }
        }
      ],
      config: {
        method: '$transaction'
      }
    }
    */
    for (const query of args.data) {
      [entityType, method] = query.config.method.split('.');
      try {  
        const queryPrismaMethod = ds.client[entityType][method];
    
        if (!queryPrismaMethod) { //Oops!
          //Check whether the entityType specified is wrong or the method
          if (!ds.client[entityType]) {
            attributes.status_code = 400;
            status_message = `Invalid entity type "${entityType}" in query`;
            datastoreSpan.setStatus({ code: SpanStatusCode.ERROR, message: status_message});
            cleanupTraces(attributes);
            return new GSStatus(false, attributes.status_code, undefined, status_message);
          }
          //If not the entity type, the method specified must be wrong.
          attributes.status_code = 500;
          status_message = `Invalid CRUD method "${entityType}" "${method}" called`;
          datastoreSpan.setStatus({ code: SpanStatusCode.ERROR, message: status_message});
          cleanupTraces(attributes);
          return new GSStatus(false, attributes.status_code, undefined, status_message);
        }  
    
      } catch (err:any) {
        childLogger.error('Caught exception %o', err.stack);
        attributes.status_code = 400;
        status_message = err.message || 'Error in getting prisma method from client!';
        datastoreSpan.setStatus({ code: SpanStatusCode.ERROR, message: status_message});
        cleanupTraces(attributes);
        return new GSStatus(false, attributes.status_code, status_message, JSON.stringify(err.stack));
      }

      transData.push(ds.client[entityType][method](query.data))
    }

    try {
      const res = await prismaMethod.bind(ds.client)(transData);
      attributes.status_code = responseCode(method);
      cleanupTraces(attributes);
      return new GSStatus(true, attributes.status_code, undefined, res);
    } catch (err: any) {
      //TODO: better check for error codes. Return 500 for server side error. 40X for client errors.
      attributes.status_code = 400;
      status_message = err.message || 'Error in query!';
      datastoreSpan.setStatus({ code: SpanStatusCode.ERROR, message: status_message});
      cleanupTraces(attributes);
      return new GSStatus(false, attributes.status_code, status_message, JSON.stringify(err.stack));
    }     

  } else {
    [entityType, method] = args.config.method.split('.');
    startDatastoreSpan(args.datasource.gsName, entityType, method);

    // Record attributes to export for datastore
    attributes = { hostname: process.env.HOSTNAME, datastore: args.datasource.gsName, model: entityType, method: method };

    try {  
      prismaMethod = ds.client[entityType][method];
  
      if (!prismaMethod) { //Oops!
        //Check whether the entityType specified is wrong or the method
        if (!ds.client[entityType]) {
          attributes.status_code = 400;
          status_message = `Invalid entity type "${entityType}" in query`;
          datastoreSpan.setStatus({ code: SpanStatusCode.ERROR, message: status_message});
          cleanupTraces(attributes);
          return new GSStatus(false, attributes.status_code, undefined, status_message);
        }
        //If not the entity type, the method specified must be wrong.
        attributes.status_code = 500;
        status_message = `Invalid CRUD method "${entityType}" "${method}" called`;
        datastoreSpan.setStatus({ code: SpanStatusCode.ERROR, message: status_message});
        cleanupTraces(attributes);
        return new GSStatus(false, attributes.status_code, undefined, status_message);
      }  
  
    } catch (err:any) {
      childLogger.error('Caught exception %o', err.stack);
      attributes.status_code = 400;
      status_message = err.message || 'Error in getting prisma method from client!';
      datastoreSpan.setStatus({ code: SpanStatusCode.ERROR, message: status_message});
      cleanupTraces(attributes);
      return new GSStatus(false, attributes.status_code, status_message, JSON.stringify(err.stack));
    }

    try {
      const res = await prismaMethod.bind(ds.client)(args.data);
      attributes.status_code = responseCode(method);
      cleanupTraces(attributes);
      return new GSStatus(true, attributes.status_code, undefined, res);
    } catch (err: any) {
      //TODO: better check for error codes. Return 500 for server side error. 40X for client errors.
      attributes.status_code = 400;
      status_message = err.message || 'Error in query!';
      datastoreSpan.setStatus({ code: SpanStatusCode.ERROR, message: status_message});
      cleanupTraces(attributes);
      return new GSStatus(false, attributes.status_code, status_message, JSON.stringify(err.stack));
    }    
  }
}

function startDatastoreSpan(datastoreName: any, pentity: any, pmethod: any) {
    // Start a datastore span
    if (pentity) {
      datastoreSpan = tracer.startSpan(`datastore: ${datastoreName} ${pentity} ${pmethod}`);
    } else {
      datastoreSpan = tracer.startSpan(`datastore: ${datastoreName} ${pmethod}`);
    }

    const spanCtx: SpanContext = datastoreSpan.spanContext();
    datastoreSpan.setAttributes({
      'traceId': spanCtx.traceId,
      'spanId': spanCtx.spanId,
      'method': pmethod,
      'model': pentity,
      'db.system': 'prisma'
    });  
}

function cleanupTraces(attributes: PlainObject) {
  datastoreSpan.setAttribute('status_code', attributes.status_code);
  datastoreSpan.end();
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