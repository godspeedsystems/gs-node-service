import { join } from 'path';
import { cwd } from 'process';
import express from 'express';
import { loadAndRegisterDefinitions } from './core/definitionsLoader';
import loadMappings from './core/mappingLoader';
import loadDatasources from './core/_datasourceLoader';
import loadEventsources from './core/_eventsourceLoader';
import { loadFunctions } from './core/functionLoader';
import loadEvents from './core/eventLoader';
import { GSActor, GSCloudEvent, GSContext, GSResponse, GSSeriesFunction, GSStatus } from './core/interfaces';
import _ from 'lodash';
import { validateRequestSchema, validateResponseSchema } from './core/jsonSchemaValidation';
import { prepareRouter } from './router/index';
import { childLogger, initilizeChildLogger, logger } from './logger';
import { DataSource, EventSource } from './core/_interfaces/sources';
export interface PlainObject {
  [key: string]: any
};

export interface GodspeedParams {
  eventsFolderPath?: string,
  workflowsFolderPath?: string,
  definitionsFolderPath?: string,
  datasourcesFolderPath?: string,
  mappingsFolderPath?: string,
  configFolderPath?: string,
  eventsourcesFolderPath?: string
}

class Godspeed {
  public datasources: { [key: string]: DataSource } = {};

  public eventsources: { [key: string]: EventSource } = {};

  public workflows: PlainObject = {};

  public eventsConfig: PlainObject = {};

  public definitions: PlainObject = {};

  public config: PlainObject = {};

  public folderPaths: {
    events: string,
    workflows: string,
    definitions: string,
    datasources: string,
    eventsources: string
  };

  constructor(params = {} as GodspeedParams) {
    // let's assume we a re getting the current directory, where module is imported
    const currentDir = cwd();

    // destruct GodspeedParams, if not supplied, assign the default value
    let {
      eventsFolderPath,
      workflowsFolderPath,
      definitionsFolderPath,
      configFolderPath,
      datasourcesFolderPath,
      eventsourcesFolderPath
    } = params;

    eventsFolderPath = join(currentDir, params.eventsFolderPath || '/src/events');
    workflowsFolderPath = join(currentDir, params.workflowsFolderPath || '/src/functions');
    definitionsFolderPath = join(currentDir, params.definitionsFolderPath || '/src/definitions');
    configFolderPath = join(currentDir, params.configFolderPath || '/config');
    datasourcesFolderPath = join(currentDir, params.datasourcesFolderPath || '/src/datasources');
    eventsourcesFolderPath = join(currentDir, params.eventsourcesFolderPath || '/src/eventsources');

    this.folderPaths = {
      events: eventsFolderPath,
      workflows: workflowsFolderPath,
      definitions: definitionsFolderPath,
      datasources: datasourcesFolderPath,
      eventsources: eventsourcesFolderPath
    };

    Object.freeze(this.folderPaths);

  }

  public initilize() {
    this._loadDefinitions()
      .then(async (definitions) => {

        this.definitions = definitions;

        let datasources = await this._loadDatasources();
        this.datasources = datasources;

        let functions = await this._loadFunctions();
        this.workflows = functions;

        let eventsources = await this._loadEventsources();
        this.eventsources = eventsources;

        let events = await this._loadEvents();
        this.eventsConfig = events;

        await this.subscribeToEvents();
      })
      .catch((error) => {
        logger.error(error);
      });
  }

  private async _loadEvents(): Promise<PlainObject> {
    logger.info('[START] Load Events');
    let events = await loadEvents(this.workflows, this.folderPaths.events);
    logger.info('Events %o', events);
    logger.info('[END] Load Events');
    return events;
  };

  private async _loadDefinitions(): Promise<PlainObject> {
    logger.info('[START] Load definitions from %s', this.folderPaths.definitions);
    const definitions = await loadAndRegisterDefinitions(this.folderPaths.definitions);
    logger.info('Definitions %o', definitions);
    logger.info('[END] Load definitions');
    return definitions;
  }

  private async _loadFunctions(): Promise<PlainObject> {
    logger.info('[START] Load functions from %s', this.folderPaths.workflows);
    const loadFnStatus = await loadFunctions(this.datasources, this.folderPaths.workflows);
    logger.info('Functions %o', Object.keys(loadFnStatus.functions));

    if (loadFnStatus.success) {
      logger.info('[END] Load Functions');
      return loadFnStatus.functions;
    } else {
      throw new Error(`Failed to load functions and workflows. Erro`);
    }
  }

  private async _loadDatasources(): Promise<PlainObject> {
    logger.info('[START] Load Datasources from %s', this.folderPaths.datasources);
    let datasources = await loadDatasources(this.folderPaths.datasources);
    logger.info('Datasources %o', datasources);
    logger.info('[END] Load Datasources');
    return datasources;
  };

  private async _loadEventsources(): Promise<PlainObject> {
    logger.info('[START] Loading Eventsources from %s', this.folderPaths.eventsources);

    let eventsources = await loadEventsources(this.folderPaths.eventsources, this.datasources);
    logger.info('Eventsources %o', eventsources);
    logger.info('[END] Loading Eventsources.');
    return eventsources;
  };

  // private async _loadDatasourceFunctions(): Promise<void> {
  //   for (let ds in this.datasources) {
  //     if (this.datasources[ds].authn) {
  //       this.datasources[ds].authn = this.workflows[this.datasources[ds].authn];
  //     }

  //     if (this.datasources[ds].before_method_hook) {
  //       this.datasources[ds].before_method_hook =
  //         this.workflows[this.datasources[ds].before_method_hook];
  //     }

  //     if (this.datasources[ds].after_method_hook) {
  //       this.datasources[ds].after_method_hook =
  //         this.workflows[this.datasources[ds].after_method_hook];
  //     }

  //     this.datasources[ds].gsName = ds;
  //     // let datasourceScript = compileScript(this.datasources[ds]);

  //     // this.datasources[ds] = datasourceScript;
  //   }
  // }

  private async subscribeToEvents(): Promise<void> {
    // events
    for await (let route of Object.keys(this.eventsConfig)) {
      let eventKey = route;
      let eventSourceName = route.split('.')[0];

      const eventSource = this.eventsources[eventSourceName];

      const processEventHandler = await this.processEvent(this);
      await eventSource.subscribeToEvent(route, this.eventsConfig[eventKey], processEventHandler);
    }
  }

  private async processEvent(local: Godspeed): Promise<(event: GSCloudEvent, eventConfig: PlainObject) => Promise<GSStatus>> {
    const { workflows, datasources } = local;

    return async (event: GSCloudEvent, eventConfig: PlainObject): Promise<GSStatus> => {
      // TODO: improve child logger initilization
      // initilize child logger
      initilizeChildLogger({});
      debugger; // eslint-disable-line
      // TODO: lot's of logging related steps
      childLogger.info('processing event ... %s %o', event.type);
      // TODO: Once the config loader is sorted, fetch the apiVersion from config
      const responseStructure: GSResponse = {
        apiVersion: '1.0'
      };

      let eventHandlerWorkflow: GSSeriesFunction;
      let validateStatus = validateRequestSchema(event.type, event, eventConfig);
      let eventSpec = eventConfig;

      if (validateStatus.success === false) {
        childLogger.error('failed to validate request body.', validateStatus);

        const responseData: PlainObject = {
          message: 'request validation failed.',
          error: validateStatus.message,
          data: validateStatus.data
        };

        // if `on_validation_error` is defined in the event, let's execute that
        if (eventSpec.on_validation_error) {
          const validationError = {
            success: false,
            code: validateStatus.code,
            ...responseData
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
        childLogger.info('Request JSON Schema validated successfully %o', validateStatus);
        eventHandlerWorkflow = <GSSeriesFunction>(workflows[eventSpec.fn]);
      }

      const ctx = new GSContext({}, datasources, event, {}, {}, logger, childLogger);

      let eventHandlerStatus;

      try {
        await eventHandlerWorkflow(ctx);
        // The final status of the handler workflow is calculated from the last task of the handler workflow (series function)
        eventHandlerStatus = ctx.outputs[eventHandlerWorkflow.id];
        logger.info('eventHandlerStatus', eventHandlerStatus);

        if (eventHandlerStatus.success) {
          // event workflow executed successfully
          // lets validate the response schema
          let validateResponseStatus = validateResponseSchema(event.type, eventHandlerStatus);
          if (!validateResponseStatus.success) {
            childLogger.error('Response JSON schema validation failed.');
            return new GSStatus(
              false, 500, 'response validation error', {
              error: {
                message: validateResponseStatus.message,
                info: validateResponseStatus.data
              }
            }
            );
          }
        }

        return eventHandlerStatus;

      } catch (error) {
        return new GSStatus(
          false,
          500,
          `Error in executing handler ${eventSpec.fn} for the event ${event.type
          }`,
          error
        );
      }
    };
  };
};

export default Godspeed;