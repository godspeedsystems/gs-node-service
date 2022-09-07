/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
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
