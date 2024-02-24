/*
 * You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
 * © 2022 Mindgrep Technologies Pvt Ltd
 */

import { PlainObject } from './common';
import { checkFunctionExists } from './utils';
import loadYaml from './yamlLoader';
import { loadJsonSchemaForEvents } from './jsonSchemaValidation';
import expandVariables from './expandVariables';
import _ from 'lodash';
import { logger } from '../logger';
import { NativeFunctions, WorkflowJSON, createGSFunction } from './functionLoader';
import { GSDataSourceAsEventSource, GSEventSource } from '../godspeed';
import { EventSources } from './_interfaces/sources';

const rewiteRefsToAbsolutePath = (
  events: PlainObject
): PlainObject | undefined => {
  if (!Object.keys(events).length) {
    // there are no events
    return;
  }
  // deep copy
  logger.debug('Replacing $refs in events with definitions.');
  const deepCopyOfEvents = JSON.parse(JSON.stringify(events));
  return Object.keys(deepCopyOfEvents).reduce(
    (accumulator: PlainObject, eventKey: string) => {
      let eventObject = deepCopyOfEvents[eventKey];
      // logger.debug('eventObject %o', eventObject);

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
      // logger.debug('responses %o', responses);
      if (responses) {
        Object.keys(responses).forEach((responseCode) => {
          let responseContent = responses[responseCode].content;
          // logger.debug('responseContent %o', responseContent);
          if (responseContent) {
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
          }
        });
      }

      accumulator[eventKey] = eventObject;
      return accumulator;
    },
    {}
  );
};

export default async function loadEvents(
  allFunctions: PlainObject,
  nativeFunctions: NativeFunctions,
  eventsFolderPath: string,
  eventSources: EventSources
) {
  const events = await loadYaml(eventsFolderPath, true);
  if (events && !Object.keys(events).length) {
    logger.error(`There are no events defined in events dir: ${eventsFolderPath}. Exiting.`);
    process.exit(1);
  }

  // logger.debug('event configs %o', events);
  const evalEvents = expandVariables(rewiteRefsToAbsolutePath(events));

  const checkFn = checkFunctionExists(events, allFunctions);

  if (!checkFn.success) {
    logger.fatal(`Error in loading functions for events. Error message: %s. Exiting. ${checkFn.message}`);
    process.exit(1);
  }
  if (evalEvents) {
    await loadJsonSchemaForEvents(evalEvents);
  }
  loadEventWorkflows(evalEvents, eventSources, allFunctions, nativeFunctions);
  return evalEvents;
};
  /**
    * Iterate through all event definitions and 
    * load the authz, on_request_validation_error, on_response_validation_error and any such workflows
  */
const FUNCTIONS_TO_LOAD = ['authz', 'on_request_validation_error', 'on_response_validation_error'];
function loadEventWorkflows(events: PlainObject, eventSources: EventSources, allFunctions:{[key: string]: Function}, nativeFunctions: NativeFunctions) {
  Object.keys(events).forEach((key: string) => {
    const eventConfig = events[key];
    const eventSourceName = key.split('.')[0];
    const eventSource: GSEventSource | GSDataSourceAsEventSource = eventSources[eventSourceName];
    if (!eventSource) {
      logger.error(`No event source found for the event uri ${eventSourceName}`);
      process.exit(1);
    }
    FUNCTIONS_TO_LOAD.forEach((functionType) => {
      if(eventConfig[functionType] === 'false') { 
        delete eventConfig[functionType];
        //remove function for this functionType if event config explicity says false
        //ex. authz: false or on_request_validation_error: false
        //If authz is undefined null or 0 it will not override default config
        //because of zero trust policy.
        // functionConfig = null;
        return;
      }
      let functionConfig: WorkflowJSON | string | Function | null;
      if(eventConfig[functionType]) {
        //for a non-falsy value, lets use this instead of the default config from event source
        functionConfig = eventConfig[functionType];
      } else if(eventSource.config[functionType]) {
        //default value from event source
        functionConfig = eventSource.config[functionType]; 
      } else {
        return;
      }
      let _function; //The loaded function
      if (typeof functionConfig === 'string') {
        //Is expected to be a valid function/workflow path
        //For ex. authz: "com.biz.common_authz"
        _function = allFunctions[functionConfig as string];
      } else if (typeof functionConfig === 'object' ) {
        //Is expected to be a `WorkflowJSON` declared within a yaml eventsource/event config
        const taskLocation = { eventSourceType: eventConfig.type, eventKey: key, fn: functionType };
        _function 
          = createGSFunction(functionConfig as WorkflowJSON,allFunctions,nativeFunctions,null,taskLocation);
      }
      if (_function) {
        eventConfig[functionType] = _function;
      } else {
        logger.error(`Could not find any valid function definition for %o when loading ${functionType} for event ${key}`, functionConfig);
        process.exit(1);
      }
    });
  });
}

