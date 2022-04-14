import YAML from 'yaml';
import fs from 'fs';
import EventEmitter from 'events';
import OpenAPIClientAxios from 'openapi-client-axios';
import express from 'express';
import { Jsonnet } from "@hanazuki/node-jsonnet";
const jsonnet = new Jsonnet();


import app from './http_listener'
import { brotliCompress } from 'zlib';


function loadFunctions() {
    return YAML.parse(fs.readFileSync('./functions.yaml', 'utf8'));
}

async function loadDatasources() {
    const datasources = YAML.parse(fs.readFileSync('./datasources.yaml', 'utf8'));

    const __ds:any = {}

    for (let ds in datasources) {
        const api = new OpenAPIClientAxios({definition: datasources[ds].schema});
        api.init();
        __ds[ds] =  await api.getClient();
    }

    return __ds
}


async function loadEvents(ee: EventEmitter, processEvent: (...args: any[]) => void) {
    const events = YAML.parse(fs.readFileSync('./events.yaml', 'utf8'));

    for (let e in events) {
        ee.on(e, processEvent)
    }

    return events
}

function httpListener(ee: EventEmitter) {
    app.use('/', function(req: express.Request, res: express.Response) {
        //TODO: convert to cloudevent
        let type = req.path + '.http.' + req.method.toLocaleLowerCase()
        console.log('type', type)
        ee.emit(type, {type, data: req.body || {}, metadata: {http: {res}}});
    })
}

async function main() {
    const datasources = await loadDatasources();
    const functions = loadFunctions();
    const ee = new EventEmitter({ captureRejections: true });
    ee.on('error', console.log);

    httpListener(ee);

    async function processEvent(event: {type: string, metadata:{http: {res: express.Response}}}) {
        const handler = functions[events[event.type].fn];
        
        //TODO: GSStatus
        let ctx = {data: {}, code: 200, message: '', success: true}
        let outputs: { [key: string]: any; } = {}

        for (let step of handler) {
            let {fn, args} = step;
            let success = true;
            
            switch(fn) {
                case 'http':
                    try {
                        const res = await datasources[args.data_source].paths[args.config.url][args.config.method](args.params, args.data, args.config)
                        outputs[step.name] = res.data;
                    } catch(ex) {
                        console.error(ex);
                        ctx.message = (ex as Error).message;
                        success = ctx.success = false;
                        ctx.code = 500;
                    }
                    break
                case 'transform':
                    console.log(outputs);
                    let snippet = "local outputs = std.extVar('outputs');\n" + args[0];

                    ctx = JSON.parse(await jsonnet.extCode("outputs", JSON.stringify(outputs))
                        .evaluateSnippet(snippet))
                    console.log(ctx.data)
                    break
                case 'emit':
                    ee.emit(args.name, args.data)
                    break;

            }

            if (!success) {
                break;
            }
        }

        if (ctx.success) {
            event.metadata.http.res.status(200).send(ctx);
        } else {
            event.metadata.http.res.status(ctx.code).send(ctx);
        }
    }

    const events = await loadEvents(ee, processEvent);
}

main();