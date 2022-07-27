import { GSCloudEvent, GSContext, GSActor } from '../../../core/interfaces';
import { logger } from '../../../core/logger';
import { compileScript } from '../../../core/utils';

//Creating GSCloudEvent
const event = new GSCloudEvent('id', '/kyc', new Date(), 'http', '1.0', {
    body: {
        "Gender": "Others",
        "name": "Kushal"
    },
    params: {},
    query: {},
    headers: {},
    files: {},
}, 'REST', new GSActor('user'),  {});

const ctx = new GSContext({}, {}, event, {}, {});
const args = `<js% 
          { code: 200,data: inputs.body.Gender}
        %>`;
const script1 = compileScript(args);
logger.debug('script1',script1 );

export { ctx, script1 };
