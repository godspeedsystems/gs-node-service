/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { PlainObject } from '../../../core/common';
import { GSStatus } from '../../../core/interfaces';
import { childLogger } from '../../../logger';

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
    childLogger.error('Error executing redis command. %s', redisMethod);
    return new GSStatus(
      false,
      400,
      `Problem executing redis method "${redisMethod}" called.`
    );
  }
}
