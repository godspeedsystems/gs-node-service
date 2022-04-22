import YAML from 'yaml';
import fs, { cpSync } from 'fs';
import EventEmitter from 'events';
import OpenAPIClientAxios from 'openapi-client-axios';
import axios from 'axios';

import express from 'express';
import { Jsonnet } from "@hanazuki/node-jsonnet";
import {GSCloudEvent, GSStatus} from './core/interfaces';


import app from './http_listener'
import { config } from 'process';
import { config as appConfig , validateSchema, validateResponse } from './core/loader';

console.log("loader events:",appConfig.app.events)
console.log("loader functions:",appConfig.app.functions)
console.log("loader datasources:",appConfig.app.datasources)

function randomString(length: number, characters: string) {
    let result = '';

    if (!characters) {
        characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    }

    let charactersLength = characters.length;
    for(let i = 0; i < length; i++ ) {
      let c = characters.charAt(Math.floor(Math.random() * charactersLength));
      if (!result && c == '0') {
          continue
      }

      result += c;
    }
    return result;
}

function randomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function loadFunctions() {
    const out:{[key:string]: any;} = {};
    const workflow = YAML.parse(fs.readFileSync(__dirname + '/../src/functions/index.yaml', 'utf8'));
    console.log(workflow)
    out[workflow.namespace + '.' + workflow.id] = workflow;
    return out;
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

            console.log('registering handler', route, method);
            // @ts-ignore   
            app[method](route, function(req: express.Request, res: express.Response) {
                //let type = req.path + '.http.' + req.method.toLocaleLowerCase()
                //console.log('type', type)
                //TODO: convert to cloudevent
                console.log('emitting http handler', originalRoute);
                ee.emit(originalRoute, {type: originalRoute, data: {
                    body: req.body,
                    params: req.params,
                    query: req.query,
                    headers: req.headers,
                }, metadata: {http: {res}}});
            })
        }
    }
}

async function main() {
    const datasources = await loadDatasources();
    const functions = loadFunctions();
    const ee = new EventEmitter({ captureRejections: true });
    ee.on('error', console.log);


    async function processEvent(event: {type: string, data:{[key:string]: any;}, metadata:{http: {res: express.Response}}}) { //GSCLoudEvent 
        console.log(events[event.type], event)
        console.log('event.type: ',event.type)
        
        let status: GSStatus = new GSStatus();
        let outputs: { [key: string]: any; } = {}

        let valid_status = validateSchema(event.type,event);
        console.log("valid status: ",valid_status)
        if(valid_status.success === false)
        {
            status.success = false
            status.code = 400
            status.message = valid_status.error[0].message
            status.data = valid_status.error
            event.metadata.http.res.status(400).send(status);
            return
        }
        
        const handler = functions[events[event.type].fn];
        console.log('calling processevent');

        for (let step of handler.tasks) {
            let {fn, args} = step;
            let success = true;

            switch(fn) {
                case 'com.gs.http':
                    try {
                        const jsonnet = new Jsonnet();
                        let snippet = `local inputs = std.extVar('inputs');
                                local randomString = std.native('randomString');
                                local randomInt = std.native('randomInt');
                        `;

                        Object.keys(appConfig.app).forEach(function(key) {
                            snippet += `local ${key} = std.extVar('${key}');\n`;
                            jsonnet.extCode(key, JSON.stringify(appConfig.app[key]));
                        });

                        jsonnet.extCode("inputs", JSON.stringify(event.data));
                        jsonnet.nativeCallback("randomString", (length, only_number) => randomString(Number(length), String(only_number)), "length", 'only_number');
                        jsonnet.nativeCallback("randomInt", (min, max) => randomInt(Number(min), Number(max)), "min", 'max');

                        snippet += JSON.stringify(args).replace(/\"\${(.*?)}\"/g, "$1")
                                .replace(/"\s*<transform>([\s\S]*?)<\/transform>[\s\S]*?"/g, '$1')
                                .replace(/\\"/g, '"')
                                .replace(/\\n/g, ' ')


                        console.log(snippet);
                        args = JSON.parse(await jsonnet.evaluateSnippet(snippet))
                        console.log(args);

                        const ds = datasources[args.datasource];
                        let res;

                        try {
                            if (ds.schema) {
                                console.log('invoking with schema');
                                res = await ds.client.paths[args.config.url][args.config.method](args.params, args.data, args.config)
                            } else {
                                console.log('invoking wihout schema');
                                res = await ds.client({
                                    ...args.config,
                                    params: args.params,
                                    data: args.data,
                                })
                            }
                        } catch(ex) {
                            console.error(ex);
                            // @ts-ignore   
                            res = ex.response;
                        }
                        outputs[step.id] = {
                            data: res.data,
                            status: res.status,
                            statusText: res.statusText,
                            headers: res.headers,
                        }
                    } catch(ex) {
                        console.error(ex);
                        success = true;
                        //if (step)
                        // console.error(ex);
                        // ctx.message = (ex as Error).message;
                        // success = ctx.success = false;
                        // ctx.code = 500;
                    }
                    break;

                case 'com.gs.transform':
                    console.log(outputs);
                    const jsonnet = new Jsonnet();

                    let snippet = "local outputs = std.extVar('outputs');\n" + args;

                    status = JSON.parse(await jsonnet.extCode("outputs", JSON.stringify(outputs))
                        .evaluateSnippet(snippet))
                    console.log(status.data)
                    break

                case 'com.gs.emit':
                    ee.emit(args.name, args.data)
                    break;

            }

            if (!success) {
                break;
            }
        }

        console.log('end', status)
        valid_status = validateResponse(event.type,status);
        console.log("Response valid status: ",valid_status)
        
        if(valid_status.success === false)
        {
            status.success = false
            status.code = 500
            status.message = 'Internal Server Error - Error in validating the response schema'
            status.data = valid_status.error
            event.metadata.http.res.status(500).send(status);
            return
        }

        if (status.success) {
            event.metadata.http.res.status(200).send(status);
        } else {
            event.metadata.http.res.status(status.code ?? 200).send(status);
        }
    }

    const events = await loadEvents(ee, processEvent);
    httpListener(ee, events);
}

main();