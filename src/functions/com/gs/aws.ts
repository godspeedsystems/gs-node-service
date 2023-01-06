/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { GSStatus } from '../../../core/interfaces';
import { logger } from '../../../core/logger';

export default async function (args: any) {
  const awsClient = args?.datasource?.client;
  const service = args.config.service;
  const method = args.config.method;
  const client = awsClient[service];

  try {
    const data = await client[method](...args.params);
    return data;
  } catch (error: any) {
    logger.error('Caught exception: %o', error.stack);
    logger.error('Error executing aws %s command. %s', service, method);
    return new GSStatus(
      false,
      400,
      `Problem executing aws "${service}" method "${method}" called.`
    );
  }
}