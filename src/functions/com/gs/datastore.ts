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
  const res = await prismaMethod(args.data);
  logger.info('prisma res %o', res);
  return res;

}