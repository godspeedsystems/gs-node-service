import { GSCloudEvent, GSContext, GSActor } from '../../../core/interfaces';
import { logger } from '../../../core/logger';
import { compileScript } from '../../../core/utils';
const mappings = {"Gender":{"Male":"M","Female":"F","Others":"O"}};

//Creating GSCloudEvent
const event = new GSCloudEvent('id', '/kyc', new Date(), 'http', '1.0', {
    body: {
        "name": "Kushal"
    },
    params: {},
    query: {},
    headers: {},
    files: {},
}, 'REST', new GSActor('user'),  {});

const ctx = new GSContext({}, {}, event, mappings, {});
const args1 = `Hello <%inputs.body.name%> Chauhan`;
const args2 = `<%inputs.body['Gender'] || 'Male'%> `;
const script1 = compileScript(args1);
const script2 = compileScript(args2);

logger.debug('script1',script1 );

export { ctx, script1 , script2};
