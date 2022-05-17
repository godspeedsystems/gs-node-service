
import * as _ from "lodash";
import { GSCloudEvent , GSActor , GSStatus } from "../core/interfaces";
import Ajv from "ajv"
import addFormats from "ajv-formats";

import { PlainObject } from "./common";
import { logger } from "./logger";

const ajv = new Ajv()

export function loadJsonSchemaForEvents(eventObj: PlainObject) {
    logger.info('Loading JSON Schema for events %s',Object.keys(eventObj))
    logger.debug(eventObj,'eventObj')
    // Add formats to ajv instance
    addFormats(ajv);

    Object.keys(eventObj).forEach(function(topic) {
        // Add body schema in ajv for each content_type per topic
        /* TODO: Right now, we are assuming that there is going to be one content_type only i.e. application/json
                This needs to be enhanced in fututre when multiple content_type will be supported
        */
       const eventObjTopic = eventObj[topic]

       //Object.keys(eventObjTopic).forEach(function(topic) {
            const body_content= eventObjTopic?.data?.schema?.body?.content;
            if (body_content) {

                Object.keys(body_content).forEach(function(k) {
                    const content_schema = body_content[k].schema;
                    if(content_schema) {
                        logger.info('adding body schema for %s', topic)
                        logger.debug(content_schema)
                        ajv.addSchema(content_schema, topic)
                    }
                });
            }

            // Add params schema in ajv for each param per topic
            const params = eventObjTopic?.data?.schema?.params;
            let paramSchema:PlainObject = {}

            if (params) {
                for (let param of params) {
                    if(param.schema) {
                        if (!paramSchema[param.in]) {
                            paramSchema[param.in] = {
                                type: 'object',
                                required: [],
                                properties: {}
                            }
                        }

                        if (param.required) {
                            paramSchema[param.in].required.push(param.name)
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
                logger.info('adding param schema for %s',topic)
                logger.debug(paramSchema[schema])

                const topic_param = topic + ':'+ schema;
                ajv.addSchema( paramSchema[schema], topic_param)
            }

            // Add responses schema in ajv for each response per topic
            const responses = eventObjTopic?.responses;
            if (responses) {
                Object.keys(responses).forEach(function(k) {
                    const response_s = responses[k]?.schema?.data?.content?.['application/json']?.schema;
                    if (response_s) {
                        const response_schema = response_s
                        const topic_response = topic + ':responses:'+ k
                        //console.log("topic_response: ",topic_response)
                        ajv.addSchema(response_schema, topic_response)
                    }
                });
            }
       });
    //});
}

/* Function to validate GSCloudEvent */
export function validateRequestSchema(topic: string, event: any, eventSpec: PlainObject): GSStatus{
    let status:GSStatus;

    // Validate event.data.body
    if (event.data.body && eventSpec?.data?.schema?.body) {
        logger.info('event body and eventSpec exist')
        logger.info('event.data.body: %o',event.data.body)
        const ajv_validate = ajv.getSchema(topic)
        if (ajv_validate) {
            logger.info('ajv_validate for body')
            if (! ajv_validate(event.data.body)) {
                logger.error('ajv_validate failed')
                status = { success: false, code: 400, message: ajv_validate.errors![0].message, data: ajv_validate.errors![0] }
                return status
            }
            else{
                logger.info('ajv_validate success')
                status = { success: true }
            }
        } else{
            status = { success: true }
        }
    } else if ( !event.data.body && eventSpec?.data?.schema?.body ) { 
        status = { success: false, code: 400, message: "Body not found in request but specified in the event schema"}
        return status
    }
    // } else if ( Object.keys(event.data.body).length && !eventSpec?.data?.schema?.body ) { 
    //     status = { success: false, code: 400, message: "Body found in request but not specified in the event schema"}
    //     return status
    // } 
    else { //Body is not present in request and not specified in the event schema
        status = { success: true }
    }

    const params = eventSpec?.data?.schema?.params;

    // Validate event.data['params']
    let MAP:PlainObject = {
        'path': 'params',
        'header': 'headers',
        'query': 'query',
        'cookie': 'cookie',
    };

    logger.info('ajv_validate for params')

    if(params) {
        for (let param in MAP) {

            const topic_param = topic + ':'+ param;
            const ajv_validate = ajv.getSchema(topic_param)

            logger.debug('topic_param: %s',topic_param)
            if(ajv_validate)
            {
                if (!ajv_validate(event.data[MAP[param]])) {
                    ajv_validate.errors![0].message += ' in ' + param;
                    status = { success: false, code: 400, message: ajv_validate.errors![0].message, data: ajv_validate.errors![0] }
                    return status
                } else {
                    status = { success: true }
                }
            }
        }
    }
    return status
}

/* Function to validate GSStatus */
export function validateResponseSchema(topic: string, gs_status: GSStatus): GSStatus{
    let status:GSStatus;
    //console.log("gs_status: ",gs_status)

    if(gs_status.data)
    {
        const topic_response = topic + ':responses:' + gs_status.code
        const ajv_validate = ajv.getSchema(topic_response)
        if(ajv_validate)
        {
            if (! ajv_validate(gs_status.data)) {
                logger.error('ajv_validate failed')
                status = { success: false, code: 400, message: ajv_validate.errors![0].message, data: ajv_validate.errors![0] }
                return status
            }
            else{
                logger.info('ajv_validate success')
                status = { success: true }
            }
        }
        else{
            status = { success: true }
        }
    }
    else {
        status = { success: true }
    }
    return status
}