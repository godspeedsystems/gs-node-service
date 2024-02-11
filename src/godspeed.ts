/* eslint-disable import/first */
import 'dotenv/config';
import { childLogger, initializeChildLogger, logger } from './logger';
try {
  if (process.env.OTEL_ENABLED == 'true') {
    require('@godspeedsystems/tracing').initialize();
  }
} catch (error) {
  logger.error("OTEL_ENABLED is set, unable to initialize opentelemetry tracing.");
  logger.error(error);
  process.exit(1);
}

var config = require('config');

import { join } from 'path';
import { cwd } from 'process';
import _ from 'lodash';
import swaggerUI from 'swagger-ui-express';
import promClient from '@godspeedsystems/metrics';

// loaders
import loadAndRegisterDefinitions from './core/definitionsLoader';
import loadDatasources from './core/datasourceLoader';
import loadEventsources from './core/eventsourceLoader';
import loadFunctions, { LoadedFunctions as LoadedFunctionsStatus, NativeFunctions } from './core/functionLoader';
import loadEvents from './core/eventLoader';
import loadMappings from './core/mappingLoader';

// interfaces
import {
  GSActor,
  GSCloudEvent,
  GSContext,
  GSSeriesFunction,
  GSStatus,
  GSResponse
} from './core/interfaces';

import {
  GSDataSource,
  GSCachingDataSource,
  GSEventSource,
  GSDataSourceAsEventSource,
  EventSources,
} from './core/_interfaces/sources';
import { PlainObject } from './types';

// validators
import {
  validateRequestSchema,
  validateResponseSchema,
} from './core/jsonSchemaValidation';

import { generateSwaggerJSON } from './router/swagger';
import { setAtPath } from './core/utils';
import loadModules from './core/codeLoader';
import { importAll } from './core/scriptRuntime';
import yamlLoader from './core/yamlLoader';

export interface GodspeedParams {
  eventsFolderPath?: string;
  workflowsFolderPath: string;
  definitionsFolderPath?: string;
  datasourcesFolderPath?: string;
  configFolderPath: string;
  eventsourcesFolderPath?: string;
  mappingsFolderPath?: string;
  pluginsFolderPath?: String;
}

class Godspeed {
  public datasources: { [key: string]: GSDataSource } = {};

  public eventsources: EventSources = {};

  public withoutEventSource: boolean = false;

  public plugins: PlainObject = {};

  public workflows: { [key: string]: Function } = {};

  public nativeFunctions: NativeFunctions = {};

  public events: PlainObject = {};

  public definitions: PlainObject = {};

  public config: PlainObject = {};

  public mappings: PlainObject = {};

  public isProd: boolean = true; //process.env.NODE_ENV === 'production';

  public folderPaths: {
    events: string;
    workflows: string;
    definitions: string;
    config: string;
    datasources: string;
    eventsources: string;
    mappings: string;
    plugins: string;
  };

  constructor(params = {} as GodspeedParams, withoutEventSource: boolean = false) {
    // config
    this.config = config;
    // let's assume we a re getting the current directory, where module is imported
    const currentDir = cwd();

    // destruct GodspeedParams, if not supplied, assign the default value
    let {
      eventsFolderPath,
      workflowsFolderPath,
      definitionsFolderPath,
      configFolderPath,
      datasourcesFolderPath,
      eventsourcesFolderPath,
      mappingsFolderPath,
      pluginsFolderPath
    } = params;

    eventsFolderPath = join(
      currentDir,
      this.isProd
        ? params.eventsFolderPath || '/dist/events'
        : params.eventsFolderPath || '/src/events'
    );
    workflowsFolderPath = join(
      currentDir,
      this.isProd
        ? params.workflowsFolderPath || '/dist/functions'
        : params.workflowsFolderPath || '/src/functions'
    );
    definitionsFolderPath = join(
      currentDir,
      this.isProd
        ? params.definitionsFolderPath || '/dist/definitions'
        : params.definitionsFolderPath || '/src/definitions'
    );
    configFolderPath = join(
      currentDir,
      this.isProd
        ? params.configFolderPath || '/config'
        : params.configFolderPath || '/config'
    );
    datasourcesFolderPath = join(
      currentDir,
      this.isProd
        ? params.datasourcesFolderPath || '/dist/datasources'
        : params.datasourcesFolderPath || '/src/datasources'
    );
    eventsourcesFolderPath = join(
      currentDir,
      this.isProd
        ? params.eventsourcesFolderPath || '/dist/eventsources'
        : params.eventsourcesFolderPath || '/src/eventsources'
    );

    mappingsFolderPath = join(
      currentDir,
      this.isProd
        ? params.mappingsFolderPath || '/dist/mappings'
        : params.mappingsFolderPath || '/src/mappings'
    );

    pluginsFolderPath = join(
      currentDir,
      this.isProd
        ? params.mappingsFolderPath || '/dist/plugins'
        : params.mappingsFolderPath || '/src/plugins'
    );

    this.folderPaths = {
      events: eventsFolderPath as string,
      workflows: workflowsFolderPath as string,
      config: configFolderPath as string,
      definitions: definitionsFolderPath as string,
      datasources: datasourcesFolderPath as string,
      eventsources: eventsourcesFolderPath as string,
      mappings: mappingsFolderPath as string,
      plugins: pluginsFolderPath as string
    };
    this.withoutEventSource = withoutEventSource;
    Object.freeze(this.folderPaths);
  }

  public async initialize() {
    await this._loadDefinitions()
      .then(async (definitions) => {
        this.definitions = definitions;
        this.mappings = await this._loadMappings();
        //@ts-ignore
        global.mappings = this.mappings;
        let datasources = await this._loadDatasources();
        this.datasources = datasources;

        this.plugins = await this._loadPlugins();

        let fnLoadResponse: LoadedFunctionsStatus = await this._loadFunctions();
        this.workflows = fnLoadResponse.functions;
        this.nativeFunctions = fnLoadResponse.nativeFunctions;
        if (!this.withoutEventSource) {
          let eventsources = await this._loadEventsources();
          this.eventsources = eventsources;

          let events = await this._loadEvents();
          this.events = events;


          await this.subscribeToEvents();

          let status = Object.keys(eventsources)
            .map((esName: string) => {
              let es: { client: PlainObject; config: PlainObject } =
                eventsources[esName];
              return `${es.config.type}: ${es.config.port}`;
            })
            .join(' ');

          logger.info(
            `[${this.isProd ? 'Production' : 'Dev'} Server][Running] ('${status.split(' ')[0]
            }' event source, '${status.split(' ')[1]}' port).`
          );
        }

      })
      .catch((error) => {
        logger.error('Error in loading the project %o %s %o', error, error.message, error.stack);
      });
  }

  public async _loadMappings(): Promise<PlainObject> {
    logger.info('[START] Load mappings from %s', this.folderPaths.mappings);
    let mappings = loadMappings(this.folderPaths.mappings);
    logger.debug('Mappings %o', mappings);
    logger.info('[END] Load mappings');
    return mappings;
  };

  private async _loadEvents(): Promise<PlainObject> {
    logger.info('[START] Load events from %s', this.folderPaths.events);
    let events = await loadEvents(this.workflows, this.nativeFunctions, this.folderPaths.events, this.eventsources);
    logger.debug('Events %o', events);
    logger.info('[END] Loaded events %o', events);
    return events;
  }

  private async _loadDefinitions(): Promise<PlainObject> {
    logger.info(
      '[START] Load definitions from %s',
      this.folderPaths.definitions
    );
    const definitions = await loadAndRegisterDefinitions(
      this.folderPaths.definitions
    );
    logger.debug('Definitions %o', definitions);
    logger.info('[END] Load definitions');
    return definitions;
  }

  private async _loadFunctions(): Promise<LoadedFunctionsStatus> {
    logger.info('[START] Load functions from %s', this.folderPaths.workflows);
    const loadFnStatus: LoadedFunctionsStatus = await loadFunctions(
      this.datasources,
      this.folderPaths.workflows
    );
    logger.debug('Functions %o', Object.keys(loadFnStatus.functions));

    if (loadFnStatus.success) {
      logger.info('[END] Load functions');
      return loadFnStatus;
    } else {
      throw new Error(`Failed to load functions.`);
    }
  }

  private async _loadPlugins(): Promise<PlainObject> {
    logger.info('[START] Load plugins from %s', this.folderPaths.plugins);
    const modules: PlainObject = await loadModules(this.folderPaths.plugins);
    importAll(modules, global);
    logger.debug('Plugins loaded %o', Object.keys(modules));
    return modules;
  }

  private async _loadDatasources(): Promise<PlainObject> {
    logger.info(
      '[START] Load data sources from %s',
      this.folderPaths.datasources
    );
    let datasources = await loadDatasources(this.folderPaths.datasources);
    //logger.debug('data sources %o', datasources);
    logger.info('[END] Load data sources');
    return datasources;
  }

  private async _loadEventsources(): Promise<PlainObject> {
    logger.info(
      '[START] Load event sources from %s',
      this.folderPaths.eventsources
    );

    let eventsources = await loadEventsources(
      this.folderPaths.eventsources,
      this.datasources
    );
    logger.debug('event sources loaded %o', Object.keys(eventsources));
    logger.info('[END] event sources.');
    return eventsources;
  }

  private async subscribeToEvents(): Promise<void> {
    const httpEvents: { [key: string]: any } = {};

    for await (let route of Object.keys(this.events)) {
      let eventKey = route;
      let eventSourceName = route.split('.')[0];
      const eventSource = this.eventsources[eventSourceName];

      // for swagger UI
      if (eventSourceName === 'http') {
        httpEvents[eventKey] = { ...this.events[eventKey] };
      }

      const processEventHandler = await this.processEvent(this, route);

      await eventSource.subscribeToEvent(
        route,
        this.events[eventKey],
        processEventHandler,
        { ...this.events[route] }
      );


    }

    const httpEventSource = this.eventsources['http']; // eslint-disable-line
    if (httpEventSource?.config?.docs) {
      const _httpEvents = generateSwaggerJSON(httpEvents, this.definitions, httpEventSource.config);
      // @ts-ignore
      httpEventSource.client.use(httpEventSource.config.docs.endpoint || '/api-docs', swaggerUI.serve, swaggerUI.setup(_httpEvents));
    }

    if (process.env.OTEL_ENABLED == 'true') {
      // @ts-ignore
      httpEventSource.client.get('/metrics', async (req, res) => {
        let prismaMetrics: string = '';
        for (let ds in this.datasources) {
          if (this.datasources[ds].client?._previewFeatures.includes("metrics")) {
            // @ts-ignore
            prismaMetrics += await this.datasources[ds].client.$metrics.prometheus({
              globalLabels: { server: process.env.HOSTNAME, datasource: `${ds}` },
            });
          }
        }
        let appMetrics = await promClient.register.metrics();

        res.end(appMetrics + prismaMetrics);
      });
    }
  }

  public async executeWorkflow(name: string, args: PlainObject): Promise<GSStatus> {
    initializeChildLogger({});
    const event: GSCloudEvent = new GSCloudEvent(
      'id',
      "",
      new Date(),
      'http',
      '1.0',
      args,
      'REST',
      new GSActor('user'),
      {}
    );
    const ctx: GSContext = new GSContext(
      this.config, this.datasources, event, this.mappings, this.nativeFunctions, this.plugins, logger, childLogger);
    const workflow = this.workflows[name];

    if (!workflow) {
      childLogger.error('workflow not found %s', name);
    }
    const res = await workflow(ctx, args);
    return res;
  }

  private async processEvent(
    local: Godspeed,
    route: string
  ): Promise<
    (event: GSCloudEvent, eventConfig: PlainObject) => Promise<GSStatus>
  > {
    const { workflows, datasources, mappings } = local;

    return async (
      event: GSCloudEvent,
      eventConfig: PlainObject
    ): Promise<GSStatus> => {
      // TODO: improve child logger initilization
      // initilize child logger
      initializeChildLogger({});
      // TODO: lot's of logging related steps
      childLogger.debug('processing event ... %s', event.type);
      // TODO: Once the config loader is sorted, fetch the apiVersion from config


      let eventHandlerWorkflow: GSSeriesFunction;
      let validateStatus = validateRequestSchema(
        event.type,
        event,
        eventConfig
      );
      let eventSpec = eventConfig;

      if (validateStatus.success === false) {
        childLogger.error(`failed to validate request body. ${validateStatus}`);

        // if `on_request_validation_error` is defined in the event, let's execute that
        if (eventSpec.on_request_validation_error) {
          const validationError = {
            success: false,
            code: validateStatus.code,
            message: 'request validation failed.',
            error: validateStatus.message,
            data: validateStatus.data
          };

          childLogger.error('Validation of event request failed %s', JSON.stringify(validationError));

          event.data = { event: event.data, validation_error: validationError };

          // A workflow is always a series execution of its tasks. ie., a GSSeriesFunction
          eventHandlerWorkflow = <GSSeriesFunction>(eventSpec.on_request_validation_error);
        } else {
          return validateStatus;
        }
      } else {
        childLogger.info(
          'Request JSON Schema validated successfully %o',
          validateStatus
        );
        eventHandlerWorkflow = <GSSeriesFunction>workflows[eventSpec.fn];
      }

      const ctx = new GSContext(
        config,
        datasources,
        event,
        mappings,
        workflows,
        {},
        logger,
        childLogger
      );
      //Now check authorization, provided request validation has succeeded
      if (eventConfig.authz && validateStatus.success) {
        //If authorization workflow fails, we return with its status right away.
        ctx.forAuth = true;
        const authzStatus: GSStatus = await eventConfig.authz(ctx);
        ctx.forAuth = false;
        if (authzStatus.code === 403 || authzStatus.success !== true) {
          //Authorization task executed successfully and returned user is not authorized

          authzStatus.success = false;
          // If status code is not set or is not in the range of 400-600 then set the code to 403
          //error status codes in http should be between 400-599
          if (!authzStatus.code || authzStatus.code < 400 || authzStatus.code > 599) {
            authzStatus.code = 403;
          }

          childLogger.debug(`Authorization task failed at the event level with code ${authzStatus.code}`);

          if (!authzStatus.data?.message) {
            setAtPath(authzStatus, 'data.message', authzStatus.message || 'Access Forbidden');
          }
          return authzStatus;
        }
        //Autorization is passed. Proceeding.
        // childLogger.debug('Authorization passed at the event level');
      }
      let eventHandlerStatus: GSStatus;

      try {
        const eventHandlerResponse = await eventHandlerWorkflow(ctx);
        // The final status of the handler workflow is calculated from the last task of the handler workflow (series function)
        eventHandlerStatus = ctx.outputs[eventHandlerWorkflow.id] || eventHandlerResponse;
        if (!eventHandlerStatus.success) {
          childLogger.error('Event handler for %s returned \n with status %o \n for inputs \n params %o \n query %o \n body %o \n headers %o', route, eventHandlerStatus, ctx.inputs.data.params, ctx.inputs.data.query, ctx.inputs.data.body, ctx.inputs.data.headers);
        } else {
          childLogger.debug('Event handler for %s returned with status %o', route, eventHandlerStatus);
        }
        if (typeof eventHandlerStatus !== 'object' || !('success' in eventHandlerStatus)) {
          //Assume workflow has returned just the data and has executed sucessfully
          eventHandlerStatus = new GSStatus(true, 200, undefined, eventHandlerResponse);
        }
        // event workflow executed successfully
        // lets validate the response schema
        let validateResponseStatus = validateResponseSchema(
          event.type,
          eventHandlerStatus
        );
        if (validateResponseStatus.success) {
          return eventHandlerStatus;
        } else {
          if (!eventSpec.on_response_validation_error) {
            childLogger.error('Validation of event response failed %o', validateResponseStatus.data);
            return new GSStatus(false, 500, 'response validation error', validateResponseStatus.data);
          } else {
            const validationError = {
              success: false,
              code: validateResponseStatus.code,
              message: 'response validation failed.',
              error: validateResponseStatus.message,
              data: validateResponseStatus.data
            };

            childLogger.error('Validation of event response failed %s', JSON.stringify(validationError));

            event.data = { event: event.data, validation_error: validationError };

            // A workflow is always a series execution of its tasks. ie., a GSSeriesFunction
            return await (eventSpec.on_response_validation_error)(ctx);
          }
        }



      } catch (error) {
        childLogger.error(`Error occured in event handler execution for event ${eventConfig.key}. Error: ${error}`);
        return new GSStatus(
          false,
          500,
          `Error in executing handler ${eventSpec.fn} for the event ${event.type} `,
          error
        );
      }
    };
  }

}

export {
  GSActor,
  GSCloudEvent,
  GSStatus,
  PlainObject,
  GSContext,
  GSResponse,
  GSDataSourceAsEventSource, // kafk, it share the client with datasource
  GSEventSource, // express. it has own mechanisim for initClient
  GSDataSource,
  GSCachingDataSource,
  yamlLoader,
  logger,
  childLogger
};

export default Godspeed;
