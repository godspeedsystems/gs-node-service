/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { GSCloudEvent, GSContext, GSActor } from '../../../core/interfaces';
import { logger } from '../../../core/logger';
import { compileScript } from '../../../core/utils';
const mappings = {"Gender":{"Male":"M","Female":"F","Others":"O"}};

//Creating GSCloudEvent
const event = new GSCloudEvent('id', '/kyc', new Date(), 'http', '1.0', {
    body: {
        "Gender": "Male",
        "name": "Kushal"
    },
    path:{
      "lender_loan_application_id":"1234"
    },
    query:{
      "bank_id":"ABC"
    },
    headers: {},
    files: {},
}, 'REST', new GSActor('user'),  {});

const ctx = new GSContext({}, {}, event, mappings, {});
const args1 = `<coffee% 'bank_id: ' + inputs.query.bank_id %>`;
const args2 = `<coffee% 'lender_loan_application_id: ' + inputs.path.lender_loan_application_id %>`;

const script1 = compileScript(args1);
const script2 = compileScript(args2);

logger.debug('script1',script1 );

export { ctx, script1, script2 };
