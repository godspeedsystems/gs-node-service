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
  const serviceClient = awsClient[service];
  const awsMethod = serviceClient[method];

  if (!awsMethod) {
    return new GSStatus(
      false,
      500,
      `Invalid AWS "${service}" method "${awsMethod}" called.`
    );
  }

  try {
    return await awsMethod.bind(serviceClient)(...args);
  } catch (error) {
    logger.error('Error executing aws %s command. %s', service, awsMethod);
    return new GSStatus(
      false,
      400,
      `Problem executing aws "${service}" method "${awsMethod}" called.`
    );
  }
}
