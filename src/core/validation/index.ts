import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { PlainObject } from '../common';
import eventSchema from './event.schema.json';
import workflowSchema from './workflow.schema.json';
import { logger } from '../../logger';

const ajvInstance = new Ajv({ allErrors: true, coerceTypes: true, strictTuples: false, strictTypes: false, strict: false });
addFormats(ajvInstance);
require('ajv-errors')(ajvInstance);

const validateEvent = ajvInstance.compile(eventSchema);
const validateWorkflow = ajvInstance.compile(workflowSchema);

export const isValidEvent = (event: PlainObject, eventKey: string): boolean => {
  const valid = validateEvent(event);
  if (!valid) {
    logger.error('Event validation failed for %s', eventKey);
    logger.error(validateEvent.errors);
  }
  return valid;
};

export const isValidWorkflow = (
  workflow: PlainObject,
  workflowKey: string
): boolean => {
  const valid = validateWorkflow(workflow);
  if (!valid) {
    logger.error('Workflow validation failed for %s', workflowKey);
    logger.error(validateWorkflow.errors);
  }
  return valid;
};

export default ajvInstance;
