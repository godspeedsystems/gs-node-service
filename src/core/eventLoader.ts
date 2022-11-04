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

const rewiteRefsToAbsolutePath = (
  events: PlainObject
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
              contentSchema.$ref =
                'https://godspeed.systems/definitions.json' + defKey;
              bodyContent[contentType].schema = contentSchema;
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
                responseContentTypeSchema.$ref =
                  'https://godspeed.systems/definitions.json' + defKey;
                responses[responseCode].content[responseContentType].schema =
                  responseContentTypeSchema;
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
  pathString: string
) {
  logger.info('Loading events');
  const events = await loadYaml(pathString, true);
  logger.debug('events %o', events);

  const evalEvents = expandVariables(rewiteRefsToAbsolutePath(events));

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
