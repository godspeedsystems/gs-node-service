import { logger } from '../../../core/logger';
import { compileScript } from '../../../core/utils';
const inputs =  {
  "Gender": "Male",
  "name": "Kushal"
};
const outputs = {
  "Gender": "Male",
  "name": "Kushal"
};
//Creating GSCloudEvent

const args = {name: '<%inputs.name%>',
Gender: '<%inputs.Gender%>'}
;



const datasourceScript: Function = compileScript(args);
const result = datasourceScript({}, inputs, outputs, {});
export { result };
