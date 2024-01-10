/* eslint-disable import/first */
import 'dotenv/config';

try {
  if (process.env.OTEL_ENABLED == 'true') {
    require('@godspeedsystems/tracing').initialize();
  }
} catch (error) {
  console.error("OTEL_ENABLED is set, unable to initialize opentelemetry tracing.");
  console.error(error);
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
import loadFunctions from './core/functionLoader';
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
  GSEventSource,
  GSDataSourceAsEventSource,
} from './core/_interfaces/sources';
import { PlainObject } from './types';

// validators
import {
  validateRequestSchema,
  validateResponseSchema,
} from './core/jsonSchemaValidation';
import { childLogger, initializeChildLogger, logger } from './logger';
import { generateSwaggerJSON } from './router/swagger';

export interface GodspeedParams {
  eventsFolderPath?: string;
  workflowsFolderPath?: string;
  definitionsFolderPath?: string;
  datasourcesFolderPath?: string;
  configFolderPath?: string;
  eventsourcesFolderPath?: string;
  mappingsFolderPath?: string;
}

class Godspeed {
  public datasources: { [key: string]: GSDataSource } = {};

  public eventsources: { [key: string]: GSEventSource } = {};

  public workflows: PlainObject = {};

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
    mappings: string
  };

  constructor(params = {} as GodspeedParams) {
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
      mappingsFolderPath
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

    this.folderPaths = {
      events: eventsFolderPath,
      workflows: workflowsFolderPath,
      config: configFolderPath,
      definitions: definitionsFolderPath,
      datasources: datasourcesFolderPath,
      eventsources: eventsourcesFolderPath,
      mappings: mappingsFolderPath
    };

    Object.freeze(this.folderPaths);
  }

  public initilize() {
    this._loadDefinitions()
      .then(async (definitions) => {
        this.definitions = definitions;
        this.mappings = await this._loadMappings();

        let datasources = await this._loadDatasources();
        this.datasources = datasources;

        let functions = await this._loadFunctions();
        this.workflows = functions;

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
      })
      .catch((error) => {
        logger.error(error.message);
      });
  }

  public initialize() {
    this.initilize();
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
    let events = await loadEvents(this.workflows, this.folderPaths.events);
    logger.debug('Events %o', events);
    logger.info('[END] Load events');
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

  private async _loadFunctions(): Promise<PlainObject> {
    logger.info('[START] Load functions from %s', this.folderPaths.workflows);
    const loadFnStatus = await loadFunctions(
      this.datasources,
      this.folderPaths.workflows
    );
    logger.debug('Functions %o', Object.keys(loadFnStatus.functions));

    if (loadFnStatus.success) {
      logger.info('[END] Load functions');
      return loadFnStatus.functions;
    } else {
      throw new Error(`Failed to load functions.`);
    }
  }

  private async _loadDatasources(): Promise<PlainObject> {
    logger.info(
      '[START] Load data sources from %s',
      this.folderPaths.datasources
    );
    let datasources = await loadDatasources(this.folderPaths.datasources);
    logger.debug('data sources %o', datasources);
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
    logger.debug('event sources %o', eventsources);
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

      const processEventHandler = await this.processEvent(this);

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
          // @ts-ignore
          if (this.datasources[ds].config.type === 'prisma') {
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

  private async processEvent(
    local: Godspeed
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
      childLogger.info('processing event ... %s %o', event.type);
      // TODO: Once the config loader is sorted, fetch the apiVersion from config
      const responseStructure: GSResponse = {
        apiVersion: '1.0',
      };

      let eventHandlerWorkflow: GSSeriesFunction;
      let validateStatus = validateRequestSchema(
        event.type,
        event,
        eventConfig
      );
      let eventSpec = eventConfig;

      if (validateStatus.success === false) {
        childLogger.error('failed to validate request body.', validateStatus);

        

        // if `on_validation_error` is defined in the event, let's execute that
        if (eventSpec.on_validation_error) {
          const validationError = {
            success: false,
            code: validateStatus.code,
            message: 'request validation failed.',
            error: validateStatus.message,
            data: validateStatus.data
          };

          childLogger.error(validationError);

          event.data = { event: event.data, validation_error: validationError };

          // A workflow is always a series execution of its tasks. ie., a GSSeriesFunction
          eventHandlerWorkflow = <GSSeriesFunction>(
            workflows[eventSpec.on_validation_error]
          );
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

      let eventHandlerStatus: GSStatus;

      try {
        const eventHandlerResponse = await eventHandlerWorkflow(ctx);
        // The final status of the handler workflow is calculated from the last task of the handler workflow (series function)
        eventHandlerStatus = ctx.outputs[eventHandlerWorkflow.id] || eventHandlerResponse;
        childLogger.info('eventHandlerStatus: %o', eventHandlerStatus);

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
        if (!validateResponseStatus.success) {
          childLogger.error('Response JSON schema validation failed');
          return new GSStatus(false, 500, 'response validation error', validateResponseStatus.data);
        }
        

        return eventHandlerStatus;
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
};

export default Godspeed;
