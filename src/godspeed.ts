import { join } from 'path';
import { cwd } from 'process';
import express from 'express';
import { loadAndRegisterDefinitions } from './core/definitionsLoader';
import loadMappings from './core/mappingLoader';
import loadDatasources from './core/datasourceLoader';
import { loadFunctions } from './core/functionLoader';
import loadEvents from './core/eventLoader';
import bodyParser from 'body-parser';
import { GSActor, GSCloudEvent, GSContext, GSResponse, GSSeriesFunction, GSStatus } from './core/interfaces';
import _ from 'lodash';
import { validateRequestSchema, validateResponseSchema } from './core/jsonSchemaValidation';

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
  httpService: Express.Application
}

class Godspeed {
  public instance: PlainObject;

  public folderPaths: {
    events: string,
    mappings: string,
    workflows: string,
    definitions: string,
    datasources: string
  };

  constructor(params = {} as GodspeedParams) {

    // let's assume we a re getting the current directory, where module is imported
    const currentDir = cwd();

    // destruct GodspeedParams, if not supplied, assign the default value
    let {
      eventsFolderPath,
      workflowsFolderPath,
      definitionsFolderPath,
      mappingsFolderPath,
      configFolderPath,
      datasourcesFolderPath
    } = params;

    eventsFolderPath = join(currentDir, params.eventsFolderPath || '/src/events');
    workflowsFolderPath = join(currentDir, params.workflowsFolderPath || '/src/functions');
    definitionsFolderPath = join(currentDir, params.definitionsFolderPath || '/src/definitions');
    mappingsFolderPath = join(currentDir, params.mappingsFolderPath || '/src/mappings');
    configFolderPath = join(currentDir, params.configFolderPath || '/config');
    datasourcesFolderPath = join(currentDir, params.datasourcesFolderPath || '/src/datasources');

    this.folderPaths = {
      events: eventsFolderPath,
      mappings: mappingsFolderPath,
      workflows: workflowsFolderPath,
      definitions: definitionsFolderPath,
      datasources: datasourcesFolderPath
    };

    Object.freeze(this.folderPaths);

    this.instance = {};
  }

  public initilize() {
    this._loadDefinitions()
      .then(async () => {
        await this._loadMappings();
      })
      .then(async () => {
        await this._loadDatasources();
      })
      .then(async () => {
        await this._loadFunctions();
      })
      .then(async () => {
        await this._loadEvents();
      })
      .then(async () => {
        // setting up the express server
        const app = express();
        app.use(bodyParser.json());

        this.instance.app = app;

        await this._subscribeToEvent();
      })
      .catch((error) => {
        console.log(error);
      });
  }

  private async _loadEvents(): Promise<void> {
    let events = await loadEvents(this.instance.functions, this.folderPaths.events);
    this.instance.events = events;
  };

  private async _loadMappings(): Promise<void> {
    await loadMappings(this.folderPaths.mappings);
  }

  private async _loadDefinitions(): Promise<void> {
    await loadAndRegisterDefinitions(this.folderPaths.definitions);
  }

  private async _loadFunctions(): Promise<void> {
    // so the loadFunctions is divided in two parts
    // first we will load the internal functions
    // and then we load the user defined functions.
    const loadFnStatus = await loadFunctions(this.instance.datasources, this.folderPaths.workflows);
    if (loadFnStatus.success) {
      this.instance.functions = loadFnStatus.functions;
      console.log('functions %o', Object.keys(this.instance.functions));
    } else {
      console.error('Error loading functions');
    }
  }

  private async _loadDatasources(): Promise<void> {
    let datasources = await loadDatasources(this.folderPaths.datasources);

    this.instance.datasources = datasources;
  }

  private async _loadDatasourceFunctions(): Promise<void> {
    for (let ds in this.instance.datasources) {
      if (this.instance.datasources[ds].authn) {
        this.instance.datasources[ds].authn = this.instance.functions[this.instance.datasources[ds].authn];
      }

      if (this.instance.datasources[ds].before_method_hook) {
        this.instance.datasources[ds].before_method_hook =
          this.instance.functions[this.instance.datasources[ds].before_method_hook];
      }

      if (this.instance.datasources[ds].after_method_hook) {
        this.instance.datasources[ds].after_method_hook =
          this.instance.functions[this.instance.datasources[ds].after_method_hook];
      }

      this.instance.datasources[ds].gsName = ds;
      // let datasourceScript = compileScript(this.instance.datasources[ds]);

      // this.instance.datasources[ds] = datasourceScript;
    }
  }

  private async _subscribeToEvent(): Promise<void> {
    // let's iterate over all the http events

    console.log('_subscribeToEvent');
    for (let route in this.instance.events) {
      let originalRoute = route;

      if (route.includes('.http.')) {
        let method = 'get';

        [route, method] = route.split('.http.');
        route = route.replace(/{(.*?)}/g, ':$1');

        console.log(route, method);

        this.instance.app.get('/', (request: express.Request, response: express.Response) => {
          console.log('Test route');
          response.sendStatus(200);
        });

        let _this = this;
        this.instance.app[method](
          route,
          async function (req: express.Request, res: express.Response) {
            console.log(
              'originalRoute: %s %o %o',
              req.params,
            );

            const reqProp = _.omit(req, [
              '_readableState',
              'socket',
              'client',
              '_parsedUrl',
              'res',
              'app'
            ]);
            const reqHeaders = _.pick(req, ['headers']);
            let data = { ...reqProp, ...reqHeaders };

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

            const httpResponse = await _this.processEvent(event);

            res
              .status(httpResponse.statusCode);
            // set headers
            // sendData
            // finally end or send
          }
        );
      }
    }

    const PORT = 3001;
    // start ther server
    this.instance.app.listen(PORT, () => {
      console.log(`Your Godspeed server is running on ${PORT}`);
    });
  }

  private async processEvent(event: GSCloudEvent): Promise<any> {

    // TODO: lot's of logging related steps

    console.log('processing event ... %s %o', event.type);

    // TODO: Once the config loader is sorted, fetch the apiVersion from config
    const responseStructure: GSResponse = {
      apiVersion: '1.0'
    };

    let eventHandlerWorkflow: GSSeriesFunction;
    let validateStatus = validateRequestSchema(event.type, event, this.instance.events[event.type]);
    let eventSpec = this.instance.events[event.type];

    if (validateStatus.success === false) {
      console.log('failed to validate request body.', validateStatus);

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

        console.log(validationError);

        event.data = { event: event.data, validation_error: validationError };

        // A workflow is always a series execution of its tasks. ie., a GSSeriesFunction
        eventHandlerWorkflow = <GSSeriesFunction>(
          this.instance.functions[eventSpec.on_validation_error]
        );
      } else {

        return (event.metadata?.http?.express?.res as express.Response)
          .status(validateStatus.code ?? 500)
          .send(validateStatus);
      }
    } else {
      console.log('Request JSON Schema validated successfully %o', validateStatus);
      eventHandlerWorkflow = <GSSeriesFunction>(this.instance.functions[eventSpec.fn]);
    }

    const ctx = new GSContext({}, this.instance.datasources, event, this.instance.mappings, {});

    let eventHandlerStatus;

    try {
      await eventHandlerWorkflow(ctx);
    } catch (error) {
      eventHandlerStatus = new GSStatus(
        false,
        500,
        `Error in executing handler ${eventSpec.fn} for the event ${event.type
        }`,
        error
      );
    }

    // this is successful execution, because, if no error happened, this will be undefined
    if (!eventHandlerStatus) {
      // The final status of the handler workflow is calculated from the last task of the handler workflow (series function)
      eventHandlerStatus = ctx.outputs[eventHandlerWorkflow.id];

      if (eventHandlerStatus.success) {
        // event workflow executed successfully
        // lets validate the response schema
        let validateResponseStatus = validateResponseSchema(event.type, eventHandlerStatus);
        if (validateResponseStatus.success) {
          console.log('Response validation is successful.');
        } else {
          console.log('Response JSON schema validation failed.');
          const responseData: PlainObject = {
            message: 'response validation error',
            error: validateResponseStatus.message,
            data: validateResponseStatus.data
          };

          return (event.metadata?.http?.express.res as express.Response)
            .status(validateResponseStatus.code ?? 500)
            .send(validateResponseStatus.data);
        }
      }

      let responseCode = Number(eventHandlerStatus?.code || (eventHandlerStatus?.success ? 200 : 500));
      let responseData = eventHandlerStatus?.data;
      let responseHeaders = eventHandlerStatus?.headers;

      (event.metadata?.http?.express.res as express.Response)
        .status(responseCode)
        .header(responseHeaders)
        .send(responseData);
    }
  };

}

interface HTTPServer {
  // milldeware
  use: Function,
}

export default Godspeed;