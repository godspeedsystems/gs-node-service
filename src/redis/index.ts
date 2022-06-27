import config from 'config';
import nodeCleanup from 'node-cleanup';
import { createClient } from 'redis';

import { logger } from '../core/logger';

const client = createClient({
    //@ts-ignore
    url: config.redis
});

client.on('error', (err) => logger.error('Redis Client Error %o', err));

export default async function() {
    //@ts-ignore
    if (!config.redis) {
        return;
    }
    await client.connect();
    nodeCleanup(function() {
        logger.info('calling redis disconnect...');
        //@ts-ignore
        this.disconnect();
      }.bind(client));

    return client;
}