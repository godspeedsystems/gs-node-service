import {getAtPath} from '../../../core/utils';
import {GSStatus} from '../../../core/interfaces';
/**
 * 
 * @param args 
 * datasource: mongo1, mongo2 
 * config.method: Prisma methods (user.create, user.findMany)
 * data: arguments specific to the prisma method being invoked
 */
export default async function(args:{[key:string]:any;}) {
  console.log('*********** args: ',args);
  const ds = args.datasource;
  const prismaMethod = <Function>getAtPath(ds.client, args.config.method); 
  const [entityType, method] = args.config.method.split('.');
  if (!prismaMethod) { //Oops!
    
    //Check whether the entityType specified is wrong or the method
    if (!ds.client[entityType]) {
      return new GSStatus(false, 400, `Invalid entity type "${entityType}" in query`);
    }
    //If not the entity type, the method specified must be wrong.
    return new GSStatus(false, 500, `Invalid CRUD method "${method}" called on the server side`);
  }
  try {
    const res = await prismaMethod(args.data);
    //logger.info('prisma res %o', res);{success, code, data, message, headers} 
    return new GSStatus(true, responseCode(method), undefined, res);
  } catch (err) {
    //TODO: better check for error codes. Return 500 for server side error. 40X for client errors.
    //@ts-ignore
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