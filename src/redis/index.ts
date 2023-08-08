/*
 * You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
 * © 2022 Mindgrep Technologies Pvt Ltd
 */
import nodeCleanup from 'node-cleanup';
import { createClient } from 'redis';
import { PlainObject } from '../core/common';
import { logger } from '../core/logger';

let client;

export default async function (datasource: PlainObject) {
  // @ts-ignore
  if (!datasource) {
    return;
  }

  const { type, ...connectionProps } = datasource;

  client = createClient({
    ...connectionProps,
  });

  client.on('error', (err) => logger.error('Redis Client Error %o', err));
  client.on('connect', () => console.log('Redis Client connection started.'));
  client.on('ready', () => console.log('Redis Client connection ready.'));

  await client.connect();

  nodeCleanup(
    function () {
      console.log('calling redis disconnect...');
      // @ts-ignore
      this.quit();
    }.bind(client)
  );

  const ds = {
    ...datasource,
    client,
  };

  return ds;
}
