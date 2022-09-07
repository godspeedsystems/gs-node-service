/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { GSCloudEvent, GSContext, GSActor } from '../../../core/interfaces';
import { logger } from '../../../core/logger';
import { compileScript } from '../../../core/utils';

//Creating GSCloudEvent
const event = new GSCloudEvent('id', '/kyc', new Date(), 'http', '1.0', {
    body: {
        "Gender": "Male",
        "name": "Kushal"
    },
    params: {"id":"1234"},
    query: {},
    headers: {},
    files: {},
}, 'REST', new GSActor('user'),  {});

const ctx = new GSContext({}, {}, event, {}, {});
//const args = `<js% inputs.body.name +' '+ inputs.body.Gender%>`;
const args = `http://x.com/<% inputs.params.id%>/application?p=<%inputs.body.Gender%>`;

const script1 = compileScript(args);
logger.debug('script1',script1 );

export { ctx, script1 };
