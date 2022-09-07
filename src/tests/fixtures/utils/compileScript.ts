/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { GSCloudEvent, GSContext, GSActor } from '../../../core/interfaces';
import { logger } from '../../../core/logger';
import { compileScript } from '../../../core/utils';
const mappings = {"Gender":{"Male":"M","Female":"F","Others":"O"}};
const inputs =  {"Gender": "Male","name": "Kushal"};
const outputs = 'M';
//Creating GSCloudEvent

const args = `<%mappings.Gender[inputs.Gender]%>`;



const datasourceScript: Function = compileScript(args);
const result = datasourceScript({}, inputs, outputs, mappings);
export { result };
