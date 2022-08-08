import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { PlainObject } from '../common';
import { logger } from '../logger';
import eventSchema from './event.schema.json';
import workflowSchema from './workflow.schema.json';

const ajvInstance = new Ajv();
addFormats(ajvInstance);

const validateEvent = ajvInstance.compile(eventSchema);
const validateWorkflow = ajvInstance.compile(workflowSchema);

export const isValidEvent = (eventInfo: {
  eventKey: string;
  event: any;
}): boolean => {
  let { eventKey, event } = eventInfo;

  let eventType;
  let eventMethod;
  if (eventKey.includes('.http.')) {
    eventType = 'http';
    [, eventMethod] = eventKey.split('.http.');

    let eventForValidation = {
      eventType,
      eventMethod,
      event,
    };

    if (!validateEvent(eventForValidation)) {
      logger.error(validateEvent.errors);
      return false;
    }
  } else if (eventKey.includes('.kafka.')) {
    // TODO: need to handle this case also
    return true;
  }
  return true;
};

export const isValidWorkflow = (workFlowInfo: {
  workflowKey: string;
  workflow: PlainObject;
}): boolean => {
  let { workflowKey, workflow } = workFlowInfo;
  logger.info('WorkflowKey %s', workflowKey);
  logger.info('Workflow %o', workflow);
  if (!validateWorkflow(workflow)) {
    logger.error(validateWorkflow.errors);
    return false;
  } else {
    return true;
  }
};

export default ajvInstance;
