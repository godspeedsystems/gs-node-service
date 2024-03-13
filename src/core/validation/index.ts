import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { PlainObject } from '../common';
import eventSchema from './eventSchema';
import workflowSchema from './workflowSchema';
import { logger } from '../../logger';

const ajvInstance = new Ajv({ allErrors: true, coerceTypes: true, strictTuples: false, strictTypes: false, strict: false });
addFormats(ajvInstance);
require('ajv-errors')(ajvInstance);

// const validateEvent = ajvInstance.compile(eventSchema);
const validateWorkflow = ajvInstance.compile(workflowSchema);

// export const isValidEvent = (event: PlainObject, eventKey: string): boolean => {
//   if (!validateEvent(event)) {
//     logger.error('Event validation failed for %s', eventKey);
//     logger.error(validateEvent.errors);
//     return false;
//   }
//   return true;
// };

export const isValidWorkflow = (
  workflow: PlainObject,
  workflowKey: string
): boolean => {
  if (!validateWorkflow(workflow)) {
    logger.error('Workflow validation failed for %s', workflowKey);
    logger.error(validateWorkflow.errors);
    return false;
  }
  return true;
};

export default ajvInstance;
