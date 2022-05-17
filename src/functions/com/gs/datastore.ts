import { logger } from '../../../core/logger';
import {getAtPath} from '../../../core/utils';
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
  try {
    const res = await prismaMethod(args.data);
    //logger.info('prisma res %o', res);{success, code, data, message, headers} 
    return {success: true, code: code(args.config.method), data: res, message: 'Successfully executed'};
  } catch (err) {
    return {success: false, code: code(args.config.method), data: err, message: 'Errorly executed'};
  }
}

function code (method: string): number {
  const methodType = method.substring(method.indexOf('.') + 1);
  return response_codes[methodType] || 200;
}
const response_codes = {
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