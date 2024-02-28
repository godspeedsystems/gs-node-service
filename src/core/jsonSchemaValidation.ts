/*
 * You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
 * © 2022 Mindgrep Technologies Pvt Ltd
 */

import { GSStatus } from './interfaces';
import { PlainObject } from './common';
import { logger, childLogger } from '../logger';
import ajvInstance, { isValidEvent } from './validation';

export function loadJsonSchemaForEvents(eventObj: PlainObject) {
  logger.debug('Loading JSON Schema for events %s', Object.keys(eventObj));
  // logger.debug('eventObj: %o', eventObj);

  return new Promise((resolve, reject) => {
    Object.keys(eventObj).forEach(function (topic) {
      // Add body schema in ajv for each content_type per topic
      /* TODO: Right now, we are assuming that there is going to be one content_type only i.e. application/json
                  This needs to be enhanced in fututre when multiple content_type will be supported
          */
      const eventObjTopic = eventObj[topic];
      if (isValidEvent(eventObjTopic, topic)) {
        //Object.keys(eventObjTopic).forEach(function(topic) {
        const body_content =
          eventObjTopic?.body?.content || //just like OpenAPI Spec but with body instead of requestBody
          eventObjTopic?.data?.schema?.body?.content; //Legacy
        if (body_content) {
          Object.keys(body_content).forEach(function (k) {
            const content_schema = body_content[k].schema;
            if (content_schema) {
              logger.debug('adding body schema for %s', topic);
              // logger.debug('content_schema %o', content_schema);
              if (!ajvInstance.getSchema(topic)) {
                ajvInstance.addSchema(content_schema, topic);
              }
            }
          });
        }

        // Add params schema in ajv for each param per topic
        const params = eventObjTopic?.parameters || eventObjTopic?.params || eventObjTopic?.data?.schema?.params;
        let paramSchema: PlainObject = {};

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

          const topic_param = topic + ':' + schema;
          if (!ajvInstance.getSchema(topic_param)) {
            try {
              ajvInstance.addSchema(paramSchema[schema], topic_param);
            } catch(err) {
              logger.fatal('error in adding schema %o', err);
              process.exit(1);
            }
          }
        }

        // Add responses schema in ajv for each response per topic
        const responses = eventObjTopic?.responses;
        if (responses) {
          Object.keys(responses).forEach(function (k) {
            const response_s =
              responses[k]?.content?.['application/json']?.schema || //Exactly as OpenApi spec
              responses[k]?.schema?.data?.content?.['application/json']?.schema; //Legacy implementation
            if (response_s) {
              const response_schema = response_s;
              const _topic = topic.replace(/{(.*?)}/g, ':$1'); //removing curly braces in topic (event key)
              const endpoint = _topic.split('.').pop(); //extracting endpoint from eventkey
              const topic_response = endpoint + ':responses:' + k;
              if (!ajvInstance.getSchema(topic_response)) {
                ajvInstance.addSchema(response_schema, topic_response);
              }
            }
          });
        }
      } else {
        logger.error(`Event config validation failed during load time for ${topic} in ${eventObj}`);
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
  const hasSchema: any = eventSpec?.body || eventSpec?.data?.schema?.body;
  if (event.data.body && hasSchema) {
    // childLogger.info('event body and eventSpec exist');
    // childLogger.debug('event.data.body: %o', event.data.body);
    const ajv_validate = ajvInstance.getSchema(eventSpec.key);
    if (ajv_validate) {
      // childLogger.debug('ajv_validate for body');
      if (!ajv_validate(event.data.body)) {
        childLogger.error('event.data.body validation failed %o', ajv_validate.errors![0]);
        status = {
          success: false,
          code: 400,
          message: ajv_validate.errors![0].message,
          data: {message: "The API cannot be executed due to a failure in request body schema validation.", error: ajv_validate.errors![0]}
        };
        return status;
      } else {
        // childLogger.info('ajv_validate success for body');
        status = { success: true };
      }
    } else {
      status = { success: true };
    }
  } else if (!event.data.body && hasSchema) {
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
      const topic_param = eventSpec.key + ':' + param;
      const ajv_validate = ajvInstance.getSchema(topic_param);

      // childLogger.debug('topic_param: %s', topic_param);
      if (ajv_validate) {
        if (!ajv_validate(event.data[MAP[param]])) {
          childLogger.debug(`Event param validation failed ${event.data[MAP[param]]} %s`, topic_param);
          ajv_validate.errors![0].message += ' in ' + param;
          status = {
            success: false,
            code: 400,
            message: ajv_validate.errors![0].message,
            data: {message: "The API cannot be executed due to a failure in request params schema validation.", error: ajv_validate.errors![0]}
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
        childLogger.error('ajv_validation of the response data failed');
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
