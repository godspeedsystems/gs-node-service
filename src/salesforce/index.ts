import jsforce from 'jsforce';
import subscribeSalesforceStream from './subscribe';

import { logger } from '../core/logger';
import { GSActor, GSCloudEvent } from '../core/interfaces';

const salesforceCacheTTL = 86400; // 24-hours

async function fetchSalesforceObjectWithCache(conn, sfid, type) {
    if (sfid == null) { throw new Error("Requires `sfid` parameter (arg 0)") }
    if (type == null) { throw new Error("Requires `type` parameter (arg 1)") }

    const cacheKey = `salesforce-cache:${sfid}`;
    const contextKey = `${type}Name`;

    let redisClient;

    let cachedValue = await redisClient.get(cacheKey);
    if (cachedValue == null) {
      const obj = await conn.sobject(type).retrieve(sfid);
      await redisClient.set(cacheKey, obj, 'EX', salesforceCacheTTL)
      return { [contextKey]: obj };
    } else {
      return { [contextKey]: cachedValue };
    }
}

async function fetchSalesforceDetails(message, conn) {
    const content = message.payload || {};
    const header  = content.ChangeEventHeader || {};
    const fetches = [];

    if (header.commitUser != null) {
      // @ts-ignore
      fetches.push(fetchSalesforceObjectWithCache(conn, header.commitUser, 'User'));
    }

    if (header.recordIds[0] != null) {
      // @ts-ignore
      fetches.push(fetchSalesforceObjectWithCache(conn, header.recordIds[0], header.entityName));
    }

    return Promise.all(fetches)
      .then( results => {
        message.context = {};
        // Merge the returned record details into the message "context" property.
        // @ts-ignore
        results.forEach( r => message.context = {...message.context, ...r} );
        return message;
      });
};

async function init(datasource) {
  var conn = new jsforce.Connection(datasource.connection);
  if (datasource.username) {
    try {
      await conn.login(datasource.username, datasource.password);
    } catch(ex) {
      logger.error('Unable to login to Sales Force', ex.stack)
    }
  }

  return {
    ...datasource,
    client: conn,
  };
}

function subscribe(topic: string, datasourceName: any, processEvent:(event: GSCloudEvent)=>Promise<any>) {
    let conn = global.datasources[datasourceName].client;
    subscribeSalesforceStream(conn, topic, async function(message) {
      let msg = await fetchSalesforceDetails(message, conn);
      const event = new GSCloudEvent('id', `${topic}.salesforce.${datasourceName}`, new Date(message.event.createdDate), 'saleforce',
            '1.0', msg, 'messagebus', new GSActor('user'),  {messagebus: {salesforce: conn}});
      const res = await processEvent(event);
      return res;
    });
}

export default {
  init,
  subscribe
}