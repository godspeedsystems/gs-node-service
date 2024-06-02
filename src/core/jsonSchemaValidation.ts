/*
 * You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
 * © 2022 Mindgrep Technologies Pvt Ltd
 */

import { GSStatus } from './interfaces';
import { PlainObject } from './common';
import { logger } from '../logger';
import ajvInstance, { isValidEvent } from './validation';

export function loadJsonSchemaForEvents(allEventsConfigs: PlainObject) {
  logger.debug('Loading JSON Schema for events %s', Object.keys(allEventsConfigs));
  // logger.debug('eventObj: %o', eventObj);

  return new Promise((resolve, reject) => {
    Object.keys(allEventsConfigs).forEach(function (route) {
      // Add body schema in ajv for each content_type per topic
      /* TODO: Right now, we are assuming that there is going to be one content_type only i.e. application/json
                  This needs to be enhanced in fututre when multiple content_type will be supported
          */
      const eventConfig = allEventsConfigs[route];
      if (isValidEvent(eventConfig, route)) {
        //Set the key in the event config. This will be needed later for ajv validation of incoming requests
        // the ajv validators for each event are stored against these keys (routes)
        eventConfig.key = route;
        
        //HANDLE BODY SCHEMA
          /**
           * Typical body in swagger spec
           * body: #requestBody 
              content:
                application/json:
                  schema:
                    type: object
                    required: ['name']
                    properties:
                      name:
                        type: string
                        example: Godspeed
           */
        const bodyContent =
          eventConfig?.body?.content || //just like OpenAPI Spec but with body instead of requestBody
          eventConfig?.data?.schema?.body?.content; //Legacy
        if (bodyContent) {
          Object.keys(bodyContent).forEach(function (k) {
            const contentSchema = bodyContent[k].schema;
            if (contentSchema) {
              logger.debug('adding body schema for %s', route);
              // logger.debug('content_schema %o', content_schema);
              if (!ajvInstance.getSchema(route)) {
                ajvInstance.addSchema(contentSchema, route);
              }
            }
          });
        }

        //HANDLE PARAMS SCHEMA

        // Add params schema in ajv for each param per topic
        const params = eventConfig?.parameters || eventConfig?.params || eventConfig?.data?.schema?.params;
        let paramSchema: PlainObject = {};
        /**
         * Typical params schema in swagger
         *   params:
              - name: id
                in: path
                required: true
                schema:
                  type: string
         */
        if (params) {
          for (let param of params) {
            if (param.schema) {
              if (!paramSchema[param.in]) {
                paramSchema[param.in] = {
                  type: 'object',
                  required: [],
                  properties: {},
                };
              }

              if (param.required) {
                paramSchema[param.in].required.push(param.name);
              }

              let schema = param.schema;
              if (param.allow_empty_value) {
                param.schema.nullable = true;
              }

              paramSchema[param.in].properties[param.name] = schema;
            }
          }
        }

        for (let schema in paramSchema) {
          // logger.debug('adding param schema for %s', topic);
          // logger.debug('param schema: %o', paramSchema[schema]);

          const topic_param = route + ':' + schema;
          if (!ajvInstance.getSchema(topic_param)) {
            try {
              ajvInstance.addSchema(paramSchema[schema], topic_param);
            } catch(err) {
              logger.fatal('error in adding schema %o', err);
              process.exit(1);
            }
          }
        }

        // HANDLE RESPONSES SCHEMA
        
        // Add responses schema in ajv for each response per topic
        const responsesSchema = eventConfig?.responses;
        /**
         * Typical response schema in swagger
         *  responses:
              200:
                content:
                  application/json: #or application/text or something else
                    schema:
                      type: string
         */
        if (responsesSchema) {
          Object.keys(responsesSchema).forEach(function (k) {
            const codeContent = responsesSchema[k]?.content || responsesSchema[k]?.schema?.data?.content; //latter is legacy implementation supporting v1
            if (!codeContent) {
              return;
            }
            const contentType = Object.keys(codeContent)[0]; //Swagger has a single key for every status code
            const responses =
              codeContent[contentType]?.schema;
            if (responses) {
              const responseSchema = responses;
              const topic = route.replace(/{(.*?)}/g, ':$1'); //removing curly braces in topic (event key)
              const endpoint = topic.split('.').pop(); //extracting endpoint from eventkey
              const topicResponse = endpoint + ':responses:' + k;
              if (!ajvInstance.getSchema(topicResponse)) {
                ajvInstance.addSchema(responseSchema, topicResponse);
              }
            }
          });
        }
      } else {
        logger.fatal(`Event config validation failed during load time for ${route}`);
        process.exit(1);
      }
    });
    resolve(1);
  });
}

/* Function to validate GSCloudEvent */
export function validateRequestSchema(
  topic: string,
  event: any,
  eventSpec: PlainObject
): GSStatus {
  let status: GSStatus;

  // Validate event.data.body
  const hasBodySchema: any = eventSpec?.body || eventSpec?.data?.schema?.body;
  if (event.data.body && hasBodySchema) {
    // childLogger.info('event body and eventSpec exist');
    // childLogger.debug('event.data.body: %o', event.data.body);
    // if (!eventSpec.key) {

    // }
    const ajv_validate = ajvInstance.getSchema(eventSpec.key);
    if (ajv_validate) {
      // childLogger.debug('ajv_validate for body');
      if (!ajv_validate(event.data.body)) {
        logger.error({event: eventSpec.key}, 'event.data.body validation failed %o \n Request body %o', ajv_validate.errors, event.data.body);
        status = {
          success: false,
          code: 400,
          message: ajv_validate.errors![0].message,
          data: {message: "The API cannot be executed due to a failure in request body schema validation.", error: ajv_validate.errors, eventBody: event.data.body}
        };
        return status;
      } else {
        // childLogger.info('ajv_validate success for body');
        status = { success: true };
      }
    } else {
      status = { success: true };
    }
  } else if (!event.data.body && hasBodySchema) {
    status = {
      success: false,
      code: 400,
      message: 'Body not found in request but specified in the event schema',
    };
    return status;
  }
  // } else if ( Object.keys(event.data.body).length && !eventSpec?.data?.schema?.body ) {
  //     status = { success: false, code: 400, message: "Body found in request but not specified in the event schema"}
  //     return status
  // }
  else {
    //Body is not present in request and not specified in the event schema
    status = { success: true };
  }

  const params = eventSpec?.parameters ||
    eventSpec?.params || //structure like open api spec
    eventSpec?.data?.schema?.params; //Legacy

  // Validate event.data['params']
  let MAP: PlainObject = {
    path: 'params',
    header: 'headers',
    query: 'query',
    cookie: 'cookie',
  };

  // childLogger.debug('ajv_validate for params');

  if (params) {
    for (let param in MAP) {
      const topicParam = eventSpec.key + ':' + param;
      const ajvValidate = ajvInstance.getSchema(topicParam);

      // childLogger.debug('topic_param: %s', topic_param);
      if (ajvValidate) {
        if (!ajvValidate(event.data[MAP[param]])) {
          logger.debug({event: eventSpec.key}, `Event param validation failed ${event.data[MAP[param]]} %s`, topicParam);
          ajvValidate.errors![0].message += ' in ' + param;
          status = {
            success: false,
            code: 400,
            message: ajvValidate.errors![0].message,
            data: {message: `The API cannot be executed due to a failure in request ${param} schema validation.`, error: ajvValidate.errors![0]}
          };
          return status;
        } else {
          // childLogger.info('ajv_validate success for params');
          status = { success: true };
        }
      }
    }
  }
  return status;
}

/* Function to validate GSStatus */
export function validateResponseSchema(
  topic: string,
  gsStatus: GSStatus
): GSStatus {
  let status: any;
  
  if (gsStatus) {
    const topicResponse = topic + ':responses:' + gsStatus.code;
    const ajvValidate = ajvInstance.getSchema(topicResponse);
    if (ajvValidate) {
      if (!ajvValidate(gsStatus.data)) {
        logger.error({event: topic, response_code: gsStatus.code}, 'ajv_validation of the response data failed %o',gsStatus.data);
        let message: string ;
        if (gsStatus.success) {
          message = `The API execution was successful. But, there was a failure in validating the response body as per the API schema for response with status code ${gsStatus.code}.`;
      } else {
          message = `The API execution was unsuccessful. Further on top of that, there was a failure in validating the API's response body as per the API schema for response with status code ${gsStatus.code}.`;
      }
      return new GSStatus(false, 500, undefined, {
          message: message,
          errors: ajvValidate.errors,
          originalResponseBody: gsStatus.data,
          originalResponseCode: gsStatus.code 
      });
      } else {
        // childLogger.debug('ajv_validate success');
        status = { success: true };
      }
    } else {
      status = { success: true };
    }
  } else {
    status = { success: true };
  }
  return status;
}
