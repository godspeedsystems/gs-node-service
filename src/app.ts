/*
 * You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
 * © 2022 Mindgrep Technologies Pvt Ltd
 */
import express from 'express';
import {
  GSActor,
  GSCloudEvent,
  GSContext,
  GSSeriesFunction,
  GSStatus,
  GSResponse,
} from './core/interfaces';
import config from 'config';
import Pino from 'pino';
import authn from './authn';
import app, { router } from './http_listener';
import { PlainObject } from './core/common';
import { logger } from './core/logger';
import loadModules from './core/codeLoader';
import { loadFunctions } from './core/functionLoader';
import { compileScript, PROJECT_ROOT_DIRECTORY } from './core/utils';
import {
  validateRequestSchema,
  validateResponseSchema,
} from './core/jsonSchemaValidation';
import loadEvents from './core/eventLoader';
import loadDatasources from './core/datasourceLoader';
import { kafka } from './kafka';
import _ from 'lodash';
import { promClient } from './telemetry/monitoring';
import { importAll } from './scriptRuntime';
import { loadAndRegisterDefinitions } from './core/definitionsLoader';
import salesforce from "./salesforce";
import cron from './cron';
import loadMappings from './core/mappingLoader';
import fs from 'fs';

let childLogger: Pino.Logger;
let mappings: PlainObject;
export { childLogger };

function subscribeToEvents(
  events: any,
  datasources: PlainObject,
  processEvent: (event: GSCloudEvent) => Promise<any>
) {
  for (let route in events) {
    let originalRoute = route;

    if (route.includes('.http.')) {
      let method = 'get';
      let required = false;

      [route, method] = route.split('.http.');
      route = route.replace(/{(.*?)}/g, ':$1');

      logger.info('registering http handler %s %s', route, method);

      if (config.has('jwt')) {
        if ('authn' in events[originalRoute]) {
          required = events[originalRoute]?.authn;
          logger.info('registering http handler %s %s', route, method);

          if (config.has('jwt')) {
            if ('authn' in events[originalRoute]) {
              required = events[originalRoute]?.authn;
            } else {
              required = true;
            }
          }

          // @ts-ignore
          router[method](
            route,
            authn(required),
            function (req: express.Request, res: express.Response) {
              logger.debug(
                'originalRoute: %s %o %o',
                originalRoute,
                req.params,
                req.files
              );
              //passing all properties of req
              const reqProp = _.omit(req, [
                '_readableState',
                'socket',
                'client',
                '_parsedUrl',
                'res',
                'app'
              ]);

              const reqHeaders = _.pick(req, [
                'headers'
              ]);

              let data = { ...reqProp, ...reqHeaders };

              //@ts-ignore
              data.file_obj = req.files;
              //@ts-ignore
              data.files = Object.values(req.files || {});
              logger.debug('inputs %o', data);

              const event = new GSCloudEvent(
                'id',
                originalRoute,
                new Date(),
                'http',
                '1.0',
                data,
                'REST',
                new GSActor('user'),
                { http: { express: { res } } }
              );
              processEvent(event);
            }
          );
        } else if (route.includes('.kafka.')) {
          let [topic, groupId] = route.split('.kafka.');
          logger.info('registering kafka handler %s %s', topic, groupId);
          kafka.subscribe(topic, groupId, 'kafka', processEvent);
        } else {
          required = true;
        }
      }

      // @ts-ignore
      router[method](
        route,
        authn(required),
        function (req: express.Request, res: express.Response) {
          logger.debug(
            'originalRoute: %s %o %o',
            originalRoute,
            req.params,
            req.files
          );
          //passing all properties of req
          const reqProp = _.omit(req, [
            '_readableState',
            'socket',
            'client',
            '_parsedUrl',
            'res',
            'app'
          ]);

          const reqHeaders = _.pick(req, [
            'headers'
          ]);

          let data = { ...reqProp, ...reqHeaders };

          //@ts-ignore
          data.file_obj = req.files;
          //@ts-ignore
          data.files = Object.values(req.files || {});
          logger.debug('inputs %o', data);

          const event = new GSCloudEvent(
            'id',
            originalRoute,
            new Date(),
            'http',
            '1.0',
            data,
            'REST',
            new GSActor('user'),
            { http: { express: { res } } }
          );
          processEvent(event);
        }
      );
    } else if (route.includes('.kafka.')) {
      let [topic, groupId] = route.split('.kafka.');
      logger.info('registering kafka handler %s %s', topic, groupId);
      kafka.subscribe(topic, groupId, 'kafka', processEvent);
    } else if (route.includes('.salesforce.')) {

      let [topic, datasourceName] = route.split('.salesforce.');
      logger.info('registering salesforce handler %s %s', topic, datasourceName);
      salesforce.subscribe(topic, datasourceName, processEvent);
    } else if (route.includes('.cron.')) {
      cron(route, processEvent);
    } else {
      // for kafka event source like {topic}.kafka1.{groupid}
      // for rabbitmq event source like {queue}.rabbitmq1
      // here we are assuming that various event sources for kafka are defined in the above format.
      let [topic, datasource] = route.split('.', 2);

      // find the client corresponding to datasource from the datasources
      if (datasource in datasources) {
        try {
          const evaluatedDatasources = datasources[datasource](
            config,
            {},
            {},
            mappings
          );
          logger.debug('evaluatedDatasources: %o', evaluatedDatasources);
          const client = evaluatedDatasources.client;
          logger.info(
            'registering %s handler, topic %s',
            route,
            topic,
          );

          client.subscribe(route, datasource, processEvent);
        } catch (err: any) {
          logger.error(
            'Caught error in registering handler: %s, error: %o',
            route,
            err
          );
          process.exit(1);
        }
      } else {
        logger.error(
          'Client not found for %s in datasources. Exiting.',
          datasource
        );
        process.exit(1);
      }
    }
  }

  // Expose metrics for all prisma clients, node and express on /metrics
  app.get('/metrics', async (req: express.Request, res: express.Response) => {
    let prismaMetrics: string = '';
    for (let ds in datasources) {
      if (datasources[ds].type === 'datastore') {
        const prismaClient = datasources[ds].client;
        prismaMetrics += await prismaClient.$metrics.prometheus({
          globalLabels: { server: process.env.HOSTNAME, datasource: `${ds}` },
        });
      }
    }
    let appMetrics = await promClient.register.metrics();
    res.end(appMetrics + prismaMetrics);
  });

  //@ts-ignore
  const baseUrl = config.base_url || '/';
  app.use(baseUrl, router);
}

function handleTempFiles(args:any){
  if(args.files){
    if (args.files) {
      if (Array.isArray(args.files)) {
          let files:PlainObject[] = _.flatten(args.files);

          for (let file of files) {
              if(fs.existsSync(file.tempFilePath)){
                  fs.unlinkSync(file.tempFilePath);
              }
          }
      } else if (_.isPlainObject(args.files)) {
          for (let key in args.files) {
              let file = args.files[key];
              if (Array.isArray(file)) {
                  for (let singleFile of file) {
                      if (singleFile.url) {
                          // do nothing
                      } else if(fs.existsSync(singleFile.tempFilePath)){
                          fs.unlinkSync(singleFile.tempFilePath);
                      }
                  }
              } else{
                  if (file.url) {
                      // do nothing
                  } else if(fs.existsSync(file.tempFilePath)){  
                      fs.unlinkSync(file.tempFilePath); 
                  }
              }
          }
      }
    }
  }
}

async function main() {
  logger.info('Main execution NODE_ENV: %s', process.env.NODE_ENV);
  let functions: PlainObject;

  await loadAndRegisterDefinitions(PROJECT_ROOT_DIRECTORY + '/definitions');
  mappings = loadMappings();

  const datasources = await loadDatasources(
    PROJECT_ROOT_DIRECTORY + '/datasources'
  );

  // @ts-ignore
  global.datasources = _.clone(datasources);

  const loadFnStatus = await loadFunctions(
    datasources,
    PROJECT_ROOT_DIRECTORY + '/functions'
  );
  if (loadFnStatus.success) {
    functions = loadFnStatus.functions;
  } else {
    logger.error('Unable to load functions exiting...');
    process.exit(1);
  }

  //load authn workflow in datasources
  for (let ds in datasources) {
    if (datasources[ds].authn) {
      datasources[ds].authn = functions[datasources[ds].authn];
    }

    if (datasources[ds].before_method_hook) {
      datasources[ds].before_method_hook = functions[datasources[ds].before_method_hook];
    }

    if (datasources[ds].after_method_hook) {
      datasources[ds].after_method_hook = functions[datasources[ds].after_method_hook];
    }

    datasources[ds].gsName = ds;
    let datasourceScript = compileScript(datasources[ds]);
    logger.debug('datasourceScript: %s', datasourceScript);
    datasources[ds] = datasourceScript;
  }

  const plugins = await loadModules(__dirname + '/plugins', true);
  importAll(plugins, global);

  logger.debug('plugins: %s', Object.keys(plugins));

  async function processEvent(event: GSCloudEvent) {
    //GSCLoudEvent

    const childLogAttributes: PlainObject = {};
    childLogAttributes.event = event.type;
    childLogAttributes.workflow_name = events[event.type].fn;
    childLogAttributes.file_name = events[event.type].fn;

    const commonLogAttributes = (config as any).log_attributes || [];

    for (const key in commonLogAttributes) {
      // eslint-disable-next-line no-template-curly-in-string
      const obj = Function('event','filter','return eval(`event.data.${filter}`)')(event,commonLogAttributes[key]);
      childLogAttributes[key] = obj;
    }

    const overrideEventLogAttributres = events[event.type].log_attributes || [];
    
    // overriding common log_attributes
    for (const key in overrideEventLogAttributres) {
      if(typeof overrideEventLogAttributres[key] === "string" && overrideEventLogAttributres[key].match(/^(?:body\?.\.?|body\.|query\?.\.?|query\.|params\?.\.?|params\.|headers\?.\.?|headers\.)/)){
        // eslint-disable-next-line no-template-curly-in-string
        const obj = Function('event','filter','return eval(`event.data.${filter}`)')(event,overrideEventLogAttributres[key]);
        childLogAttributes[key] = obj;
      }else{
        childLogAttributes[key] = overrideEventLogAttributres[key];
      }
    }

    logger.debug('childLogAttributes: %o', childLogAttributes);
    childLogger = logger.child(childLogAttributes);

    childLogger.info('Processing event %s', event.type);
    childLogger.info('event inputs %o', _.cloneDeep(event.data));
    childLogger.debug('event spec: %o', events[event.type]);
    const responseStructure: GSResponse = {
      apiVersion: (config as any).api_version || '1.0',
    };

    // A workflow is always a series execution of its tasks. I.e. a GSSeriesFunction
    let eventHandlerWorkflow: GSSeriesFunction;
    let valid_status: PlainObject = validateRequestSchema(
      event.type,
      event,
      events[event.type]
    );

    if (valid_status.success === false) {
      childLogger.error('Failed to validate Request JSON Schema %o', valid_status);
      const response_data: PlainObject = {
        message: 'request validation error',
        error: valid_status.message,
        data: valid_status.data,
      };

      if (!events[event.type].on_validation_error) {
        // For non-REST events, we can stop now. Now that the error is logged, nothing more needs to be done.
        if (event.channel !== 'REST') {
          return;
        }

        if(event.channel == 'REST' && event.data?.files && event?.data?.files?.length > 0){
          handleTempFiles(event.data);
        }

        return (event.metadata?.http?.express.res as express.Response)
          .status(valid_status.code)
          .send(response_data);
      } else {
        childLogger.debug(
          'on_validation_error: %s',
          events[event.type].on_validation_error
        );

        const validationError = {
          success: false,
          code: valid_status.code,
          ...response_data,
        };
        event.data = { event: event.data, validation_error: validationError };

        // A workflow is always a series execution of its tasks. I.e. a GSSeriesFunction
        eventHandlerWorkflow = <GSSeriesFunction>(
          functions[events[event.type].on_validation_error]
        );
      }
    } else {
      childLogger.info(
        'Request JSON Schema validated successfully %o',
        valid_status
      );

      // A workflow is always a series execution of its tasks. I.e. a GSSeriesFunction
      eventHandlerWorkflow = <GSSeriesFunction>functions[events[event.type].fn];
    }

    childLogger.info(
      'calling processevent, type of handler is %s',
      typeof eventHandlerWorkflow
    );

    const ctx = new GSContext(
      config,
      datasources,
      event,
      mappings,
      plugins
    );

    let eventHandlerStatus; //This will be initialized onthe event when handler errors out, or on its success.
    try {
      childLogger.setBindings({ workflow_name: '' });
      // Execute the workflow
      await eventHandlerWorkflow(ctx);
    } catch (err: any) {
      childLogger.error(
        { workflow_name: events[event.type].fn },
        `Error in executing handler ${events[event.type].fn} for the event ${event.type
        }. \n Error message: ${err.message}. \n Error Stack: ${err.stack}`
      );
      // For non-REST events, we can stop now. Now that the error is logged, nothing more needs to be done.
      if (event.channel !== 'REST') {
        return false;
      }
      // Continuining, in case of REST channel, set the status to error mode with proper code and message
      eventHandlerStatus = new GSStatus(
        false,
        err.code || 500, //Treat as internal server error by default
        `Error in executing handler ${events[event.type].fn} for the event ${event.type
        }`,
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
      return ctx.outputs[eventHandlerWorkflow.id].success;
    }

    //Continuing for REST events: to validate the handler response and send the HTTP response

    //eventHandlerStatus being undefined means there was no error. Because on error,
    //we are initializing the eventHandlerStatus with the error data, in the catch block above.
    const successfulExecution = !eventHandlerStatus;
    childLogger.setBindings({ workflow_name: events[event.type].fn, 'task_id': '' });
    if (successfulExecution) {
      // Means no error happened

      // The final status of the handler workflow is calculated from the last task of the handler workflow (series function)
      eventHandlerStatus = ctx.outputs[eventHandlerWorkflow.id];
      if (eventHandlerStatus.success) {
        // Check the handler's reponse data now, against the event's response schema

        valid_status = validateResponseSchema(event.type, eventHandlerStatus);

        if (valid_status.success) {
          childLogger.info('Validate Response JSON Schema Success', valid_status);
        } else {
          childLogger.error('Failed to validate Response JSON Schema', valid_status);
          const response_data: PlainObject = {
            message: 'response validation error',
            error: valid_status.message,
            data: valid_status.data,
          };
          if(event.channel == 'REST' && event.data?.files && event?.data?.files?.length > 0){
            handleTempFiles(event.data);
          }
          return (event.metadata?.http?.express.res as express.Response)
            .status(valid_status.code)
            .send(response_data);
        }
      }
    }

    let code: number;
    if (Number.isInteger(eventHandlerStatus?.code)) {
      code = eventHandlerStatus?.code || (eventHandlerStatus?.success ? 200 : 500);
    } else {
      if ( eventHandlerStatus?.success) {
        code = eventHandlerStatus?.success ? 200 : 500;
      } else {
        code = 500;
      }
    }

    let data = eventHandlerStatus?.data;
    let headers = eventHandlerStatus?.headers;

    if (Number.isInteger(data)) {
      data = data.toString();
    }

    if (code < 400) {
      childLogger.info('return value %o %o %o', _.cloneDeep(data), code, headers);
    } else {
      childLogger.error('return value %o %o %o', _.cloneDeep(data), code, headers);
    }

    if(event.channel == 'REST' && event.data?.files && event?.data?.files?.length > 0){
      handleTempFiles(event.data);
    }

    (event.metadata?.http?.express.res as express.Response)
      .status(code)
      .header(headers)
      .send(data);

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

  const events = await loadEvents(
    functions,
    PROJECT_ROOT_DIRECTORY + '/events'
  );
  subscribeToEvents(events, datasources, processEvent);
}

main();