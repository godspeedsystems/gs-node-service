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
  const ds = args.datasource;
  const prismaMethod = <Function>getAtPath(ds.client, args.config.method);  
  if (!prismaMethod) {
    const entityType = args.config.method.substring(0, args.config.method.indexOf('.'));
    //Check whether the entityType specified is wrong or the method
    if (!ds.client[entityType]) {
      return new GSStatus(false, 400, `Invalid entity type "${entityType}" in query`);
    }
    //The method specified must be wrong.
    const method = args.config.method.substring(args.config.method.indexOf('.') + 1);
    return new GSStatus(false, 500, `Invalid CRUD method "${method}" called on the server side`);
  }
  try {
    const res = await prismaMethod(args.data);
    //logger.info('prisma res %o', res);{success, code, data, message, headers} 
    return new GSStatus(true, code(args.config.method), undefined, res);
  } catch (err) {
    //TODO: better check for error codes. Return 500 for server side error. 40X for client errors.
    //@ts-ignore
    return new GSStatus(false, 400, err.message || 'Error in query!', JSON.stringify(err.stack));
  }
}

function code (method: string): number {
  const methodType = method.substring(method.indexOf('.') + 1);
  return response_codes[methodType] || 200;
}
const response_codes: {[key: string]: number} = {
  find:200,
  findFirst:200,
  findUnique:200,
  findMany:200,
  create:201,
  createMany:201,
  update:204,
  updateMany:204,
  upsert:201,
  delete:202,
  deleteMany:202,
  count:200,
  aggregate:200,
  groupBy:200,
}