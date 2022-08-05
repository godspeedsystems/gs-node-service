import nodeCleanup from 'node-cleanup';
import { createClient } from 'redis';
import { PlainObject } from '../core/common';
import { logger } from '../core/logger';

let client;

export default async function (datasource: PlainObject) {
  const { type, ...connectionProps } = datasource;
  // @ts-ignore
  if (!datasource) {
    return;
  }

  client = createClient({
    ...connectionProps,
  });

  client.on('error', (err) => logger.error('Redis Client Error %o', err));
  client.on('connect', () => logger.info('Redis Client connection started.'));
  client.on('ready', () => logger.info('Redis Client connection ready.'));

  await client.connect();

  nodeCleanup(
    function () {
      logger.info('calling redis disconnect...');
      // @ts-ignore
      this.disconnect();
    }.bind(client)
  );

  try {
    logger.info('redis client %o', client);
    const response = await client.set('hello', 'ashutosh');
    logger.info('redis test success %o', response);
  } catch (error) {
    logger.error('redis test failed %o', error);
  }
  const ds = {
    ...datasource,
    client,
  };

  return ds;
}
