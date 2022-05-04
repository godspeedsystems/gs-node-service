import EventEmitter from 'events';
import OpenAPIClientAxios from 'openapi-client-axios';
import axios from 'axios';

import express from 'express';
import {GSActor, GSCloudEvent, GSContext, GSFunction, GSParallelFunction, GSSeriesFunction, GSStatus, GSSwitchFunction, GSResponse} from './core/interfaces';

import config from 'config';

import app from './http_listener'
import { config as appConfig } from './core/loader';
import { PlainObject } from './core/common';
import { logger } from './core/logger';

import loadYaml from './core/yamlLoader';
import loadModules from './core/codeLoader';

import {loadJsonSchemaForEvents, validateRequestSchema, validateResponseSchema} from './core/jsonSchemaValidation';
import { checkDatasource } from './core/utils';

function JsonnetSnippet(plugins:any) {
    let snippet = `local inputs = std.extVar('inputs');
        local mappings = std.extVar('mappings');
        local config = std.extVar('config');
    `;

    for (let fn in plugins) {
        let f = fn.split('.')
        fn = f[f.length - 1];

        snippet += `
            local ${fn} = std.native('${fn}');
            `
    }

    return snippet;
}


function createGSFunction(workflowJson: PlainObject, workflows: PlainObject, nativeFunctions: PlainObject): GSFunction {
    logger.info('Creating GSFunction %s',workflowJson.id)
    if (!workflowJson.fn) {
        if (Array.isArray(workflowJson)) {
            workflowJson = { tasks: workflowJson, fn: 'com.gs.sequential' };
        } else {
            workflowJson.fn = 'com.gs.sequential';
        }
    }

    let tasks;

    logger.debug(workflowJson, 'workflow')
    logger.debug(nativeFunctions) // Not displaying the object --> Need to check
    switch(workflowJson.fn) {
        case 'com.gs.sequential':
            tasks = workflowJson.tasks.map((taskJson:PlainObject) => createGSFunction(taskJson, workflows, nativeFunctions));
            return new GSSeriesFunction(workflowJson.id, undefined, tasks,
                    workflowJson.summary, workflowJson.description);

        case 'com.gs.parallel':
            tasks = workflowJson.tasks.map((taskJson:PlainObject) => createGSFunction(taskJson, workflows, nativeFunctions));
            return new GSParallelFunction(workflowJson.id, undefined, tasks,
                    workflowJson.summary, workflowJson.description);

        case 'com.gs.switch':
            let args = [workflowJson.value];
            let cases:PlainObject = {};

            for (let c in workflowJson.cases) {
                cases[c] = createGSFunction(workflowJson.cases[c], workflows, nativeFunctions);
            }

            if (workflowJson.defaults) {
                cases.default = createGSFunction(workflowJson.defaults, workflows, nativeFunctions);
            }

            args.push(cases);

            return new GSSwitchFunction(workflowJson.id, undefined, args,
                    workflowJson.summary, workflowJson.description);
    }

    logger.info('loading workflow %s',workflowJson.fn)

    //Load the fn for this GSFunction
    let fn = nativeFunctions[workflowJson.fn] //First check if it's a native function
    let subwf = false
    if (!fn) { //If not a native function, it should be a GSFunction/Json
        const existingWorkflowData = workflows[workflowJson.fn]
        if (!(existingWorkflowData instanceof GSFunction) ) { //Is still a Json data, not converted to GSFunction
            subwf = true
            fn = workflows[workflowJson.fn] = createGSFunction(existingWorkflowData, workflows, nativeFunctions);
        } else { //Is a GSFunction already
            fn = existingWorkflowData        
        }
    }

    return new GSFunction(workflowJson.id, fn, workflowJson.args,
        workflowJson.summary, workflowJson.description, workflowJson.on_error, workflowJson.retry, subwf);
}

async function loadFunctions(datasources: PlainObject): Promise<PlainObject> {
    logger.info('Loading functions')
    let code = await loadModules(__dirname + '/functions');
    let functions = await loadYaml(__dirname + '/functions');
    let loadFnStatus:PlainObject;

    logger.info('Loaded functions: %s',Object.keys(functions))
    logger.info('Loaded native functions: %s',Object.keys(code))

    for (let f in functions) {
        const checkDS = checkDatasource(functions[f], datasources);
        if (!checkDS.success) {
            loadFnStatus = { success: false , message: checkDS.message }
            return loadFnStatus;
        }
    }

    for (let f in functions) {
        if (!(functions[f] instanceof GSFunction)) {
            functions[f] = createGSFunction(functions[f], functions, code);
        }
    }
    loadFnStatus = { success: true, functions: functions}
    return loadFnStatus
}

function expandVariable(value: string) {
    try {
        if ((value as string).includes('<%')) {
            console.log('value before', value)

            value = (value as string).replace(/"?<%\s*(.*?)\s*%>"?/, '$1');
            //TODO: pass other context variables
            value = Function('config', 'return ' + value)(config);
            logger.debug('value after %s', value)
        }
    } catch(ex) {
        //console.error(ex);
        logger.error(ex);
    }
    return value;
}

async function loadDatasources() {
    logger.info('Loading datasources')
    const datasources = await loadYaml(__dirname + '/datasources', false);

    logger.debug('Loaded datasources %o',datasources)
    logger.info('Loaded datasources: %s',Object.keys(datasources))

    const ds:PlainObject = {}

    for (let s in datasources) {
        const security = datasources[s].security;
        const securitySchemes = datasources[s].securitySchemes;

        //TODO: Expand all the variables in a datasource
        if (datasources[s].schema) {
            const api = new OpenAPIClientAxios({definition: datasources[s].schema});
            api.init();
            ds[s] =  {
                client: await api.getClient(),
                schema: true,
            }
        } else {
            ds[s] =  {
                client: axios.create({
                    baseURL: expandVariable(datasources[s].base_url)
                }),
                schema: false
            };

            logger.debug('security %o',security)

            if (security && security.length) {
                for (let values of security) {

                    let [scheme, value] = Object.entries(values)[0];
                    let securityScheme = securitySchemes[scheme];

                    if(securityScheme.type == 'apiKey') {
                        if (securityScheme.in == 'header') {
                            try {
                                value = expandVariable(value as string);
                                ds[s].client.defaults.headers.common[securityScheme.name] = value;
                                logger.debug('Adding header %s: %s',securityScheme.name,value)
                            } catch(ex) {
                                //console.error(ex);
                                logger.error(ex);
                            }
                        }
                    }
                    else if(securityScheme.type == 'http') {
                        if (securityScheme.scheme == 'basic') {
                            let auth = {username: '', password: ''};
                            if (Array.isArray(value)) {
                                auth.username = expandVariable(value[0]);
                                auth.password = expandVariable(value[1]);
                            }
                            else {
                                //@ts-ignore
                                auth.username = expandVariable(value.username);
                                //@ts-ignore
                                auth.password = expandVariable(value.password);
                            }

                            ds[s].client.defaults.auth = auth;
                        }
                        else if (securityScheme.scheme == 'bearer') {
                            ds[s].client.defaults.headers.common['Authorization'] = `Bearer ${expandVariable(value as string)}`;
                        } else {
                            ds[s].client.defaults.headers.common['Authorization'] = `${securityScheme.scheme} ${expandVariable(value as string)}`;
                        }
                    }
                }
            }
        }
    }

    return ds
}


async function loadEvents(ee: EventEmitter, processEvent: (...args: any[]) => void) {
    logger.info('Loading events')
    const events = await loadYaml(__dirname + '/events', true)
    logger.debug(events,'events')
    logger.info('Loaded events: %s',Object.keys(events))

    loadJsonSchemaForEvents(events)

    //TODO Handle index.yaml events and nested directories
    for (let e in events) {
        ee.on(e, processEvent)
    }

    return events
}

function httpListener(ee: EventEmitter, events: any) {

    for (let route in events) {
        if (route.includes('.http.')) {
            let method = 'get';
            let originalRoute = route;

            [route, method] = route.split('.http.')
            route = route.replace(/{(.*?)}/g, ":$1");

            logger.info('registering handler %s %s', route, method)
            // @ts-ignore
            app[method](route, function(req: express.Request, res: express.Response) {
                logger.debug('originalRoute: %s', originalRoute, req.params, req.files)
                logger.debug('req.params: %s', req.params)
                logger.debug('req.files: %s', req.files)

                const event = new GSCloudEvent('id', originalRoute, new Date(), 'http', '1.0', {
                    body: req.body,
                    params: req.params,
                    query: req.query,
                    headers: req.headers,
                    //@ts-ignore
                    files: Object.values(req.files || {}),
                }, 'REST', new GSActor('user'),  {http: {express:{res}}});
                ee.emit(originalRoute, event);
            })
        }
    }

    for (let method of ['get', 'put', 'post', 'patch', 'delete']) {
        app[method]('*', function(req: express.Request, res: express.Response) {
            const resStructure: GSResponse = { apiVersion: config.apiVersion || "1.0" };
            logger.error('%s not found',req.url)
            resStructure.error = { 
                code: 404,
                message: `${req.url} not found`,
                errors: [ { message: `${req.url} not found`, location: `${req.url}`}]
            }
            res.status(404).send(resStructure);
        });
    }
}

async function main() {
    logger.info('Main execution');
    let functions:PlainObject;

    const ee = new EventEmitter({ captureRejections: true });
    ee.on('error', console.log);

    const datasources = await loadDatasources();
    const loadFnStatus = await loadFunctions(datasources);
    if (loadFnStatus.success) {
        functions = loadFnStatus.functions
    } else {
        ee.emit('error', new Error(JSON.stringify(loadFnStatus)));
    }

    const plugins = await loadModules(__dirname + '/plugins', true);
    const jsonnetSnippet = JsonnetSnippet(plugins);

    logger.debug(plugins,'plugins');

    async function processEvent(event: GSCloudEvent) { //GSCLoudEvent
        logger.debug(events[event.type], event)
        logger.info('Processing event %s',event.type)
        const responseStructure:GSResponse = { apiVersion: config.apiVersion || "1.0" };

        let valid_status:PlainObject = validateRequestSchema(event.type, event, events[event.type]);

        if(valid_status.success === false)
        {
            logger.error(valid_status, 'Failed to validate Request JSON Schema')
            responseStructure.error = { 
                code: valid_status.code,
                message: valid_status.message,
                errors: [ { message: valid_status.message, location: valid_status.data.schemaPath}]
            }
            return (event.metadata?.http?.express.res as express.Response).status(valid_status.code).send(responseStructure);
        }
        logger.info(valid_status, 'Request JSON Schema validated successfully')

        const handler = functions[events[event.type].fn] as GSFunction;
        logger.info('calling processevent, type of handler is %s',typeof(handler))

        const ctx = new GSContext(
            config,
            datasources,
            {},
            event,
            appConfig.app.mappings,
            jsonnetSnippet,
            plugins
        );
        await handler(ctx)

        //TODO: always output of the last task
        let status = ctx.outputs[handler.args[handler.args.length - 1].id];
        valid_status = validateResponseSchema(event.type, status);
        
        if (valid_status.success) {
            logger.info(valid_status, 'Validate Response JSON Schema')
        } else {
            logger.error(valid_status, 'Validate Response JSON Schema')
        }
        
        if (status.success) {            
            logger.debug(status, 'end');
            responseStructure.data = { 
                items: [ status.data ]
            };    
            (event.metadata?.http?.express.res as express.Response).status(200).send(responseStructure);
        } else {
            logger.error(status, 'end');
            responseStructure.error = { 
                code: status.code ?? 200,
                message: status.message,
                errors: [ { message: status.message}]
            };
            (event.metadata?.http?.express.res as express.Response).status(status.code ?? 200).send(responseStructure);
        }

    }

    const events = await loadEvents(ee, processEvent);
    httpListener(ee, events);
}

main();
