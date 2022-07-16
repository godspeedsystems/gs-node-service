import express from 'express';
import {GSActor, GSCloudEvent, GSContext, GSFunction, GSParallelFunction, GSSeriesFunction, GSStatus, GSSwitchFunction, GSResponse} from './core/interfaces';

import config from 'config';

import app, {router} from './http_listener';
import { config as appConfig } from './core/loader';
import { PlainObject } from './core/common';
import { logger } from './core/logger';

import loadModules from './core/codeLoader';
import { loadFunctions } from './core/functionLoader';
import { PROJECT_ROOT_DIRECTORY } from './core/utils';

import {validateRequestSchema, validateResponseSchema} from './core/jsonSchemaValidation';
import loadEvents from './core/eventLoader';
import loadDatasources from './core/datasourceLoader';
import { kafka } from './kafka';

let datasources: PlainObject;

function subscribeToEvents(events: any, processEvent:(event: GSCloudEvent)=>Promise<any>) {
    
    for (let route in events) {
        let originalRoute = route;

        if (route.includes('.http.')) {
            let method = 'get';

            [route, method] = route.split('.http.');
            route = route.replace(/{(.*?)}/g, ":$1");

            logger.info('registering http handler %s %s', route, method);
            // @ts-ignore
            router[method](route, function(req: express.Request, res: express.Response) {
                logger.debug('originalRoute: %s %o %o', originalRoute, req.params, req.files);

                const event = new GSCloudEvent('id', originalRoute, new Date(), 'http', '1.0', {
                    body: req.body,
                    params: req.params,
                    query: req.query,
                    headers: req.headers,
                    //@ts-ignore
                    files: Object.values(req.files || {}),
                }, 'REST', new GSActor('user'),  {http: {express:{res}}});
                processEvent(event);
            });
        } else if (route.includes('.message_bus.')) {
            let [topic, datasrcGrpId] = route.split('.message_bus.');
            let [datasourceName, groupId] = datasrcGrpId.split('.');
            logger.info('registering message_bus handler for datasource %s on topic %s and groupId %s', datasourceName, topic, groupId);
            const messageBusClient = datasources[datasourceName];
            messageBusClient.subscribe(topic, groupId, processEvent);
        } else if (route.includes('.kafka.')) {
            let [topic, groupId] = route.split('.kafka.');
            logger.info('registering kafka handler %s %s', topic, groupId);
            kafka.subscribe(topic, groupId, processEvent);
        }
    }

    //@ts-ignore
    const baseUrl = config.base_url || '/';
    app.use(baseUrl, router);
}

async function main() {
    logger.info('Main execution');
    let functions:PlainObject;

    datasources = await loadDatasources(PROJECT_ROOT_DIRECTORY + '/datasources');
    const loadFnStatus = await loadFunctions(datasources,PROJECT_ROOT_DIRECTORY + '/functions');
    if (loadFnStatus.success) {
        functions = loadFnStatus.functions;
    } else {
        logger.error('Unable to load functions exiting...');
        process.exit(1);
    }

    const plugins = await loadModules(__dirname + '/plugins', true);

    logger.debug(plugins,'plugins');

    async function processEvent(event: GSCloudEvent) { //GSCLoudEvent
        logger.debug(events[event.type], event);
        logger.info('Processing event %s',event.type);
        const responseStructure:GSResponse = { apiVersion: (config as any).api_version || "1.0" };

        let valid_status:PlainObject = validateRequestSchema(event.type, event, events[event.type]);

        if(valid_status.success === false)
        {
            logger.error(valid_status, 'Failed to validate Request JSON Schema');
            const response_data: PlainObject = { 'message': 'request validation error','error': valid_status.message, 'data': valid_status.data};
            return (event.metadata?.http?.express.res as express.Response).status(valid_status.code).send(response_data);
        }
        logger.info(valid_status, 'Request JSON Schema validated successfully');

         // A workflow is always a series execution of its tasks. I.e. a GSSeriesFunction
        const eventHandlerWorkflow:GSSeriesFunction = <GSSeriesFunction>functions[events[event.type].fn];

        logger.info('calling processevent, type of handler is %s',typeof(eventHandlerWorkflow));

        const ctx = new GSContext(
            config,
            datasources,
            event,
            appConfig.app.mappings,
            plugins
        );

        let eventHandlerStatus; //This will be initialized onthe event when handler errors out, or on its success.
        try {
          // Execute the workflow
          await eventHandlerWorkflow(ctx);
        } catch (err: any) {
          logger.error(`Error in executing handler ${events[event.type].fn} for the event ${event.type}. \n Error message: ${err.message}. \n Error Stack: ${err.stack}`);
          // For non-REST events, we can stop now. Now that the error is logged, nothing more needs to be done.
          if (event.channel !== 'REST') {
            return;
          }
          // Continuining, in case of REST channel, set the status to error mode with proper code and message
          eventHandlerStatus = new GSStatus(
            false, 
            err.code || 500, //Treat as internal server error by default
            `Error in executing handler ${events[event.type].fn} for the event ${event.type}`, 
            err //status data
          );
        }
        /**
         * For non-rest events, stop now. Nothing more needs to be done.
         * For REST events check the response schema. If OK, 
         * send the status data over the wire to the caller. Else send response validation error.
        **/

       // Continue further only for REST events, whether or not handler executed successfully.
        if (event.channel !== 'REST') {
          return;
        } 

        //Continuing for REST events: to validate the handler response and send the HTTP response

        //eventHandlerStatus being undefined means there was no error. Because on error, 
        //we are initializing the eventHandlerStatus with the error data, in the catch block above.
        const successfulExecution = !eventHandlerStatus;
        if (successfulExecution) { // Means no error happened

          // The final status of the handler workflow is calculated from the last task of the handler workflow (series function)
          eventHandlerStatus = ctx.outputs[eventHandlerWorkflow.id];
          if (eventHandlerStatus.success) {
            // Check the handler's reponse data now, against the event's response schema

            valid_status = validateResponseSchema(event.type, eventHandlerStatus);

            if (valid_status.success) {
                logger.info(valid_status, 'Validate Response JSON Schema Success');
            } else {
                logger.error(valid_status, 'Failed to validate Response JSON Schema');
                const response_data: PlainObject = { 'message': 'response validation error','error': valid_status.message, 'data': valid_status.data };
                return (event.metadata?.http?.express.res as express.Response).status(valid_status.code).send(response_data);
            }
          }
        }
        
        let code = eventHandlerStatus?.code || (eventHandlerStatus?.success ? 200 : 500);
        let data = eventHandlerStatus?.data;
        let headers = eventHandlerStatus?.headers;

        if (Number.isInteger(data)) {
            data = data.toString();
        }

        logger.debug('return value %o %o %o', data, code, headers);
        (event.metadata?.http?.express.res as express.Response).status(code).header(headers).send(data);

        // //Now send the actual response over REST, for both the success and failure scenarios
        // if (eventHandlerStatus?.success) {
        //     logger.debug(eventHandlerStatus, 'Request Successful End');
        //     responseStructure.data = {
        //         items: [ eventHandlerStatus?.data ]
        //     };
        //     (event.metadata?.http?.express.res as express.Response).status(eventHandlerStatus?.code || 200).send(responseStructure);
        // } else {
        //     logger.error(eventHandlerStatus, 'Response Error End');
        //     responseStructure.error = {
        //         code: eventHandlerStatus?.code ?? 500,
        //         message: eventHandlerStatus?.message,
        //         errors: [ eventHandlerStatus?.data ]
        //     };
        //     (event.metadata?.http?.express.res as express.Response).status(eventHandlerStatus?.code ?? 500).send(responseStructure);
        // }
    }

    const events = await loadEvents(functions,PROJECT_ROOT_DIRECTORY + '/events');
    subscribeToEvents(events, processEvent);
}

main();
