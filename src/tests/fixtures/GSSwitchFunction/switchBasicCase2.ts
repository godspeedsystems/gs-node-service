import config from 'config';
import path from 'path';
import { PlainObject } from '../../../core/common';
import loadModules from '../../../core/codeLoader';
import loadDatasources from '../../../core/datasourceLoader';
import { loadFunctions } from '../../../core/functionLoader';
import { JsonnetSnippet } from '../../../core/utils';
import loadYaml from '../../../core/yamlLoader';
import { logger } from '../../../core/logger';
import { GSCloudEvent, GSActor, GSContext, GSSeriesFunction, GSStatus } from '../../../core/interfaces';

let functions:PlainObject;
let events:PlainObject;
let ctx:GSContext;
let event: GSCloudEvent;

//Load inputs for GSFunction execution
async function loadInputs() {
    const testName = path.basename(__filename).split('.')[0];
    const mappings = {};
    const originalRoute = '/switch.http.post';
    const datasources = await loadDatasources(__dirname + '/datasources');
    const loadFnStatus = await loadFunctions(datasources, __dirname + '/functions');
    if (loadFnStatus.success) {
        functions = loadFnStatus.functions;
    } else {
        logger.error('error: %s',new Error(JSON.stringify(loadFnStatus)));
    }

    const plugins = await loadModules(__dirname + '/plugins', true);
    const jsonnetSnippet = JsonnetSnippet(plugins);
    events = await loadYaml(__dirname + '/events', true);

    //Creating GSCloudEvent
    event = new GSCloudEvent('id', originalRoute, new Date(), 'http', '1.0', {
        body: {
            "condition": "SECOND"
        },
        params: {},
        query: {},
        headers: {},
        files: {},
    }, 'REST', new GSActor('user'),  {});

    //Creating GSContext
    ctx = new GSContext(
        config,
        datasources,
        event,
        mappings,
        jsonnetSnippet,
        plugins
    );
}

export default async function() {
    await loadInputs();
    // Find event handler for this event
    const eventHandlerWorkflow:GSSeriesFunction = <GSSeriesFunction>functions[events[event.type].fn];

    let eventHandlerStatus;
    try {
    // Execute the workflow
    await eventHandlerWorkflow(ctx);

    } catch (err: any) {
    logger.error( `Error in executing handler ${events[event.type].fn} for the event ${event.type}`, JSON.stringify(err));
    eventHandlerStatus = new GSStatus(
        false, 
        err.code || 500, //Treat as internal server error by default
        `Error in executing handler ${events[event.type].fn} for the event ${event.type}`, 
        JSON.stringify(err) //status data
    );
    }
    logger.debug('ctx.outputs: %o',ctx.outputs);
    return ctx.outputs[eventHandlerWorkflow.args[eventHandlerWorkflow.args.length - 1].id];
}