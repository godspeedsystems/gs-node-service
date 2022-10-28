/*
 * You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
 * © 2022 Mindgrep Technologies Pvt Ltd
 */

import { PlainObject } from './common';
import { logger } from './logger';
import { checkFunctionExists } from './utils';
import loadYaml from './yamlLoader';
import { loadJsonSchemaForEvents } from './jsonSchemaValidation';
import expandVariables from './expandVariables';
import _ from 'lodash';

const replaceRefsInEvents = (
  events: PlainObject,
  definitions: PlainObject
): PlainObject | undefined => {
  if (!Object.keys(events).length) {
    // there are no events
    return;
  }
  // deep copy
  logger.info('Replacing $refs in events with definitions.');
  const deepCopyOfEvents = JSON.parse(JSON.stringify(events));
  return Object.keys(deepCopyOfEvents).reduce(
    (accumulator: PlainObject, eventKey: string) => {
      let eventObject = deepCopyOfEvents[eventKey];
      logger.info('eventObject %o', eventObject);

      const bodyContent =
        eventObject?.body?.content || eventObject?.data?.body?.content;

      if (bodyContent) {
        Object.keys(bodyContent).forEach((contentType: string) => {
          let contentSchema = bodyContent[contentType].schema;
          if (contentSchema) {
            if (contentSchema.hasOwnProperty('$ref')) {
              const defKey = contentSchema.$ref;
              logger.info('defKey=%s in definitions=%o', defKey, definitions);
              if (_.has(definitions, defKey)) {
                contentSchema = _.get(definitions, defKey);
                bodyContent[contentType].schema = contentSchema;
              } else {
                logger.error(`${defKey} is not defined in definitions.`);
                process.exit(1);
              }
            }
          }
        });
      }

      const responses =
        eventObject?.responses || eventObject?.data?.schema?.responses;
      logger.info('responses %o', responses);
      if (responses) {
        Object.keys(responses).forEach((responseCode) => {
          let responseContent = responses[responseCode].content;
          logger.info('responseContent %o', responseContent);
          Object.keys(responseContent).forEach((responseContentType) => {
            let responseContentTypeSchema =
              responseContent[responseContentType].schema;
            if (responseContentTypeSchema) {
              if (responseContentTypeSchema.hasOwnProperty('$ref')) {
                const defKey = responseContentTypeSchema.$ref;
                if (_.has(definitions, defKey)) {
                  responseContentTypeSchema = _.get(definitions, defKey);
                  responses[responseCode].content[responseContentType].schema =
                    responseContentTypeSchema;
                } else {
                  logger.error(`${defKey} is not defined in definitions.`);
                  process.exit(1);
                }
              }
            }
          });
        });
      }

      accumulator[eventKey] = eventObject;
      return accumulator;
    },
    {}
  );
};

export default async function loadEvents(
  functions: PlainObject,
  definitions: PlainObject,
  pathString: string
) {
  logger.info('Loading events');
  const events = await loadYaml(pathString, true);
  logger.debug('events %o', events);
  //   logger.info('Loaded events: %s', Object.keys(events));
  let eventsAfterReplacement = replaceRefsInEvents(events, definitions);
  logger.debug('refReplacedEvents %o', eventsAfterReplacement);
  const evalEvents = expandVariables(eventsAfterReplacement);

  const checkFn = checkFunctionExists(events, functions);
  if (!checkFn.success) {
    logger.error(
      'Error in loading functions for events. Error message: %s. Exiting.',
      checkFn.message
    );
    process.exit(1);
  }
  loadJsonSchemaForEvents(evalEvents);
  return evalEvents;
}
