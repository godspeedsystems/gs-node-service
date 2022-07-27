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
const args = `<js% inputs.body.name + inputs.body.Gender%>`;



//const args = `data: <%inputs.body.Gender %> <%inputs.body.name%>`;
// const args = `data: <%inputs.body.Gender %>
//         success: <% outputs.test.success %> 
//         `;

const script1 = compileScript(args);
logger.debug('script1',script1 );

export { ctx, script1 };
