import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { PlainObject } from '../common';
import { logger } from '../logger';
import eventSchema from './event.schema.json';
import workflowSchema from './workflow.schema.json';
import apiDsSchema from './datasources/api.schema.json';
import redisDsSchema from './datasources/redis.schema.json';
import kafkaDsSchema from './datasources/kafka.schema.json';

const ajvInstance = new Ajv({ allErrors: true });
addFormats(ajvInstance);
require('ajv-errors')(ajvInstance);

const validateEvent = ajvInstance.compile(eventSchema);
const validateWorkflow = ajvInstance.compile(workflowSchema);
const validateApiDs = ajvInstance.compile(apiDsSchema);
const validateRedisDs = ajvInstance.compile(redisDsSchema);
const validateKafkaDs = ajvInstance.compile(kafkaDsSchema);

export const isValidEvent = (event: PlainObject, eventKey: string): boolean => {
  if (!validateEvent(event)) {
    logger.error('Event validation failed for %s', eventKey);
    logger.error(validateEvent.errors);
    return false;
  }
  return true;
};

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

export const isValidApiDatasource = (datasource: PlainObject): boolean => {
  if (!validateApiDs(datasource)) {
    logger.error(
      'Datasource validation failed for %s datasource',
      JSON.stringify(datasource)
    );
    logger.error(validateApiDs.errors);
    return false;
  }
  return true;
};

export const isValidRedisDatasource = (datasource: PlainObject): boolean => {
  if (!validateRedisDs(datasource)) {
    logger.error(
      'Datasource validation failed for %s datasource',
      JSON.stringify(datasource)
    );
    logger.error(validateRedisDs.errors);
    return false;
  }
  return true;
};

export const isValidKafkaDatasource = (datasource: PlainObject): boolean => {
  if (!validateKafkaDs(datasource)) {
    logger.error(
      'Datasource validation failed for %s datasource',
      JSON.stringify(datasource)
    );
    logger.error(validateKafkaDs.errors);
    return false;
  }
  return true;
};

export default ajvInstance;
