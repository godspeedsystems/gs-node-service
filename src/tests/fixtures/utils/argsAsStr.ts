import { logger } from '../../../core/logger';
import { compileScript } from '../../../core/utils';
const inputs =  {
    "Gender": "Others"
};
const outputs = {
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
//Creating GSCloudEvent

const args =`<js% if(outputs.output_task1.data.json.code == 200) {
    return {
      code: outputs.output_task1.code,
      success: outputs.output_task1.success,
      data: outputs.output_task1.data.json,
      headers: outputs.output_task1.data.headers
    };
  } else {
    return {
      code: 500,
      success : false,
      message: 'error in output_task1'
    }
  } %>`;



const datasourceScript: Function = compileScript(args);
const result = datasourceScript({}, inputs, outputs, {});
export { result };
