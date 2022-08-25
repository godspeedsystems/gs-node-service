import { PlainObject } from '../../../core/common';
import { GSStatus } from '../../../core/interfaces';
import { logger } from '../../../core/logger';

export default async function (args: PlainObject) {
  const redisClient = args?.datasource?.client;
  const method = args.config.method;

  const redisMethod = redisClient[method];

  if (!redisMethod) {
    return new GSStatus(
      false,
      500,
      `Invalid Redis method "${redisMethod}" called.`
    );
  }

  try {
    const { key, value } = args.data;
    const response = await redisMethod.bind(redisClient)(key, value);
    return response;
  } catch (error) {
    logger.error('Error executing redis command. %s', redisMethod);
    return new GSStatus(
      false,
      400,
      `Problem executing redis method "${redisMethod}" called.`
    );
  }
}
