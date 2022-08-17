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
