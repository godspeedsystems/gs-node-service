import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { PlainObject } from '../common';
import { logger } from '../logger';
import eventSchema from './event.schema.json';
import workflowSchema from './workflow.schema.json';
import apiDsSchema from './datasources/api.schema.json';
import redisDsSchema from './datasources/redis.schema.json';
import kafkaDsSchema from './datasources/kafka.schema.json';
import elasticgraphSchema from './datasources/elasticgraph.schema.json';

const ajvInstance = new Ajv({ allErrors: true, coerceTypes: true });
addFormats(ajvInstance);
require('ajv-errors')(ajvInstance);

const validateEvent = ajvInstance.compile(eventSchema);
const validateWorkflow = ajvInstance.compile(workflowSchema);
const validateApiDs = ajvInstance.compile(apiDsSchema)
const validateRedisDs = ajvInstance.compile(redisDsSchema);
const validateKafkaDs = ajvInstance.compile(kafkaDsSchema);
const validElasticgraphDs = ajvInstance.compile(elasticgraphSchema);

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

export const isValidApiDatasource = (datasource: PlainObject): boolean => {
  const valid = validateApiDs(datasource);
  if (!valid) {
    logger.error(
      'Datasource validation failed for %s datasource',
      JSON.stringify(datasource)
    );
    logger.error(validateApiDs.errors);
  }
  return valid;
};

export const isValidRedisDatasource = (datasource: PlainObject): boolean => {
  const valid = validateRedisDs(datasource);
  if (!valid) {
    logger.error(
      'Datasource validation failed for %s datasource',
      JSON.stringify(datasource)
    );
    logger.error(validateRedisDs.errors);
  }
  return valid;
};

export const isValidKafkaDatasource = (datasource: PlainObject): boolean => {
  const valid = validateKafkaDs(datasource);
  if (!valid) {
    logger.error(
      'Datasource validation failed for %s datasource',
      JSON.stringify(datasource)
    );
    logger.error(validateKafkaDs.errors);
  }
  return valid;
};

export const isValidElasticgraphDatasource = (
  datasource: PlainObject
): boolean => {
  const valid = validElasticgraphDs(datasource);
  if (!valid) {
    logger.error(
      'Datasource validation failed for %s datasource',
      JSON.stringify(datasource)
    );
    logger.error(validElasticgraphDs.errors);
  }
  return valid;
};

export default ajvInstance;
