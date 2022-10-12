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
import authn from './authn';

import app, { router } from './http_listener';
import { config as appConfig } from './core/loader';
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
import { loadDefinitions } from './core/definitionsLoader';

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
          let data = _.pick(req, [
            'baseUrl',
            'body',
            'cookies',
            'fresh',
            'hostname',
            'ip',
            'ips',
            'method',
            'originalUrl',
            'params',
            'path',
            'protocol',
            'query',
            'route',
            'secure',
            'signedCookies',
            'stale',
            'subdomains',
            'xhr',
            'headers',
          ]);

          logger.info('inputs %o', data);
          //@ts-ignore
          data.files = Object.values(req.files || {});
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
      // for kafka event source like {topic}.kafka1.{groupid}
      // here we are assuming that various event sources for kafka are defined in the above format.
      let [topic, kafkaDatasource, groupId] = route.split('.', 3);

      // find the client corresponding to kafkaDatasource from the datasources
      if (kafkaDatasource in datasources) {
        try {
          const evaluatedDatasources = datasources[kafkaDatasource](
            config,
            {},
            {},
            appConfig.app.mappings
          );
          logger.debug('evaluatedDatasources: %o', evaluatedDatasources);
          const kafkaClient = evaluatedDatasources.client;
          logger.info(
            'registering %s handler, topic %s, groupId %s',
            route,
            topic,
            groupId
          );
          kafkaClient.subscribe(topic, groupId, kafkaDatasource, processEvent);
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
          kafkaDatasource
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

  // Expose /health endpoint
  app.get('/health', async (req: express.Request, res: express.Response) => {
    return res.status(200).send('OK');
  });

  //@ts-ignore
  const baseUrl = config.base_url || '/';
  app.use(baseUrl, router);
}

async function main() {
  logger.info('Main execution');
  let functions: PlainObject;

  const definitions = loadDefinitions(PROJECT_ROOT_DIRECTORY + '/definitions');

  const datasources = await loadDatasources(
    PROJECT_ROOT_DIRECTORY + '/datasources'
  );

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
    logger.info('Processing event %s', event.type);
    logger.debug('cloud event: %o', event);
    logger.debug('event spec: %o', events[event.type]);
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
      logger.error('Failed to validate Request JSON Schema %o', valid_status);
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
        return (event.metadata?.http?.express.res as express.Response)
          .status(valid_status.code)
          .send(response_data);
      } else {
        logger.debug(
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
      logger.info(
        'Request JSON Schema validated successfully %o',
        valid_status
      );

      // A workflow is always a series execution of its tasks. I.e. a GSSeriesFunction
      eventHandlerWorkflow = <GSSeriesFunction>functions[events[event.type].fn];
    }

    logger.info(
      'calling processevent, type of handler is %s',
      typeof eventHandlerWorkflow
    );

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
      logger.error(
        `Error in executing handler ${events[event.type].fn} for the event ${
          event.type
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
        `Error in executing handler ${events[event.type].fn} for the event ${
          event.type
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
    if (successfulExecution) {
      // Means no error happened

      // The final status of the handler workflow is calculated from the last task of the handler workflow (series function)
      eventHandlerStatus = ctx.outputs[eventHandlerWorkflow.id];
      if (eventHandlerStatus.success) {
        // Check the handler's reponse data now, against the event's response schema

        valid_status = validateResponseSchema(event.type, eventHandlerStatus);

        if (valid_status.success) {
          logger.info('Validate Response JSON Schema Success', valid_status);
        } else {
          logger.error('Failed to validate Response JSON Schema', valid_status);
          const response_data: PlainObject = {
            message: 'response validation error',
            error: valid_status.message,
            data: valid_status.data,
          };
          return (event.metadata?.http?.express.res as express.Response)
            .status(valid_status.code)
            .send(response_data);
        }
      }
    }

    let code =
      eventHandlerStatus?.code || (eventHandlerStatus?.success ? 200 : 500);
    let data = eventHandlerStatus?.data;
    let headers = eventHandlerStatus?.headers;

    if (Number.isInteger(data)) {
      data = data.toString();
    }

    logger.debug('return value %o %o %o', data, code, headers);
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
    definitions,
    PROJECT_ROOT_DIRECTORY + '/events'
  );
  subscribeToEvents(events, datasources, processEvent);
}

main();
