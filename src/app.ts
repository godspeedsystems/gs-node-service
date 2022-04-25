import EventEmitter from 'events';
import OpenAPIClientAxios from 'openapi-client-axios';
import axios from 'axios';

import express from 'express';
import {GSActor, GSCloudEvent, GSContext, GSFunction, GSParallelFunction, GSSeriesFunction, GSStatus, GSSwitchFunction} from './core/interfaces';

import app from './http_listener'
import { config } from 'process';
import { config as appConfig , validateSchema, validateResponse } from './core/loader';
import { PlainObject } from './core/common';

import loadYaml from './core/yamlLoader';
import loadModules from './core/codeLoader';

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


function createGSFunction(workflow: PlainObject, code: PlainObject): GSFunction {
    if (!workflow.fn) {
        if (Array.isArray(workflow)) {
            workflow = { tasks: workflow, fn: 'com.gs.sequential' };
        }
        else {
            workflow.fn = 'com.gs.sequential';
        }
    }

    let tasks;

    console.log("workflow: ",workflow)
    switch(workflow.fn) {
        case 'com.gs.sequential':
            tasks = workflow.tasks.map((flow:PlainObject) => createGSFunction(flow, code));
            return new GSSeriesFunction(workflow.id, undefined, tasks,
                    workflow.summary, workflow.description);

        case 'com.gs.parallel':
            tasks = workflow.tasks.map((flow:PlainObject) => createGSFunction(flow, code));
            return new GSParallelFunction(workflow.id, undefined, tasks,
                    workflow.summary, workflow.description);

        case 'com.gs.switch':
            let args = [workflow.value];
            let cases:PlainObject = {};
            
            for (let c in workflow.cases) {
                cases[c] = createGSFunction(workflow.cases[c], code);
            }

            if (workflow.defaults) {
                cases.default = createGSFunction(workflow.defaults, code);
            }

            args.push(cases);

            return new GSSwitchFunction(workflow.id, undefined, args,
                    workflow.summary, workflow.description);
    }

    console.log('loading workflow', workflow.fn);
    return new GSFunction(workflow.id, code[workflow.fn], workflow.args,
        workflow.summary, workflow.description);
}

async function loadFunctions(datasources: PlainObject) {
    let code = await loadModules(__dirname + '/../dist/functions');
    let functions = await loadYaml(__dirname + '/../src/functions');

    console.log('functions loaded', functions, code);
    for (let f in functions) {
        functions[f] = createGSFunction(functions[f], code);
    }
    return functions
}

function expandVariable(value: string) {
    try {
        if ((value as string).includes('${')) {
            value = (value as string).replace('"\${(.*?)}"', '$1');
            //TODO: pass other context variables
            value = Function('config', 'return ' + value)(config);
        }
    } catch(ex) {
        console.error(ex);
    }
    return value;
}

async function loadDatasources() {
    const datasources = appConfig.app.datasources;

    const ds:any = {}

    for (let s in datasources) {
        const security = datasources[s].security;
        const securitySchemes = datasources[s].securitySchemes;

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
                    baseURL: datasources[s].base_url
                }),
                schema: false
            };

            console.log('security', security);

            if (security && security.length) {
                for (let values of security) {

                    let [scheme, value] = Object.entries(values)[0];
                    let securityScheme = securitySchemes[scheme];

                    if(securityScheme.type == 'apiKey') {
                        if (securityScheme.in == 'header') {
                            try {
                                value = expandVariable(value as string);
                                ds[s].client.defaults.headers.common[securityScheme.name] = value;
                                console.log('Adding header', securityScheme.name, value);
                            } catch(ex) {
                                console.error(ex);
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
    const events = appConfig.app.events

    //TODO Handle index.yaml events and nested directories
    for (let e in events) {
        const event = Object.keys(events[e])[0]
        events[event] = events[e][event]
        delete events[e]
        ee.on(event, processEvent)
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

            console.log('registering handler', route, method);
            // @ts-ignore   
            app[method](route, function(req: express.Request, res: express.Response) {
                //let type = req.path + '.http.' + req.method.toLocaleLowerCase()
                //console.log('type', type)
                console.log('emitting http handler', originalRoute);
                const event = new GSCloudEvent('id', originalRoute, new Date(), 'http', '1.0', {
                    body: req.body,
                    params: req.params,
                    query: req.query,
                    headers: req.headers,
                }, 'REST', new GSActor('user'),  {http: {express:{res}}});
                ee.emit(originalRoute, event);
            })
        }
    }
}

async function main() {
    const datasources = await loadDatasources();
    const functions = await loadFunctions(datasources);
    const plugins = await loadModules(__dirname + '/../dist/plugins');
    const jsonnetSnippet = JsonnetSnippet(plugins);

    const ee = new EventEmitter({ captureRejections: true });
    ee.on('error', console.log);

    console.log('plugins', plugins);

    async function processEvent(event: GSCloudEvent) { //GSCLoudEvent 
        console.log(events[event.type], event)
        console.log('event.type: ',event.type)
        
        let status: GSStatus = new GSStatus();
        let valid_status = validateSchema(event.type,event);
        console.log("valid status: ",valid_status)
        if(valid_status.success === false)
        {
            status.success = false
            status.code = 400
            status.message = valid_status.error[0].message
            status.data = valid_status.error
            (event.metadata?.http?.express.res as express.Response).status(400).send(status);
            return
        }
        
        const handler = functions[events[event.type].fn] as GSFunction;
        console.log('calling processevent', typeof(handler));

        const ctx = new GSContext(
            {},
            datasources,
            {},
            event,
            appConfig.app.mappings,
            jsonnetSnippet,
            plugins
        );
        await handler(ctx)
        
        //TODO: always output of the last task
        status = ctx.outputs[handler.args[handler.args.length - 1].id];
        console.log('end', status)
        valid_status = validateResponse(event.type, status);
        console.log("Response valid status: ",valid_status)
        
        if(valid_status.success === false)
        {
            status.success = false
            status.code = 500
            status.message = 'Internal Server Error - Error in validating the response schema'
            status.data = valid_status.error
            (event.metadata?.http?.express.res as express.Response).status(500).send(status);
            return
        }

        if (status.success) {
            (event.metadata?.http?.express.res as express.Response).status(200).send(status);
        } else {
            (event.metadata?.http?.express.res as express.Response).status(status.code ?? 200).send(status);
        }
    }

    const events = await loadEvents(ee, processEvent);
    httpListener(ee, events);
}

main();