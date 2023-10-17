/*
 * You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
 * © 2022 Mindgrep Technologies Pvt Ltd
 */
import nodeCleanup from 'node-cleanup';
import { createClient, createCluster }  from 'redis';
import { PlainObject } from '../core/common';
import { logger } from '../core/logger';

let client;

export default async function (datasource: PlainObject): Promise<{[key: string]: any;} | null > {
  // @ts-ignore
  if (!datasource) {
    return null;
  }

  const { type, cluster: clusterConfig, ...connectionProps } = datasource;

  // cluster mode
  // in yaml, we define all the createCluster props in `cluster` key
  // for more info, https://github.com/redis/node-redis/blob/master/docs/clustering.md
  if(cluster) {
    client = await createCluster({
      ...clusterConfig,
    });
  } else {
    client = await createClient({
      ...connectionProps,
    });
  }

  client?.on('error', (err: Error) => logger.error('Redis Client Error %o', err));
  client?.on('connect', () => logger.info('Redis Client connection started.'));
  client?.on('ready', () => logger.info('Redis Client connection ready.'));

  await client?.connect();

  nodeCleanup(
    function () {
      logger.info('calling redis disconnect...');
      // @ts-ignore
      this.quit();
    }.bind(client)
  );

  const ds: {[key: string]: any;} = {
    ...datasource,
    client,
  };

  return ds;
}
