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
        "Gender": "Others"
    },
    params: {},
    query: {},
    headers: {},
    files: {},
}, 'REST', new GSActor('user'),  {});

const ctx = new GSContext({}, {}, event, {}, {});
ctx.outputs ={
  "output_task1": {
      "message": "OK",
      "code": 200,
      "success": true,
      "data": {
          "headers": {
              "Host": "httpbin.org"
          },
          "json": {
              "code": 200
          }
      }
  }
};
const args = `<js% if(outputs.output_task1.data.json.code == 200) {
    return {
      code: outputs.output_task1.code,
      success: outputs.output_task1.success,
      data: inputs.body.Gender,
      headers: outputs.output_task1.data.headers
    };
  } else {
    return {
      code: 500,
      success : false,
      message: 'error in output_task1'
    }
  } %>`;

const script1 = compileScript(args);
logger.debug('script1',script1 );

export { ctx, script1 };
