import { Jsonnet } from "@hanazuki/node-jsonnet";
import { GSContext, GSStatus } from "../../../core/interfaces";

export default async function(args:{[key:string]:any;}, ctx: GSContext, stepId: string) {
    try {
        const jsonnet = new Jsonnet();
        let snippet = "local inputs = std.extVar('inputs');\n";
        
        jsonnet.extCode("inputs", JSON.stringify(ctx.inputs));
        
        snippet += JSON.stringify(args).replace(/\"\${(.*?)}\"/g, "$1")
        console.log(snippet);
        args = JSON.parse(await jsonnet.evaluateSnippet(snippet))
        console.log(args);

        const ds = ctx.datasources[args.datasource];
        let res;

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
        ctx.outputs[stepId] = new GSStatus(true, res.status, '', {data: res.data, statusText: res.statusText, headers: res.headers});
    } catch(ex) {
        console.error(ex);
        ctx.outputs[stepId] = new GSStatus(false, 500, (ex as Error).message)
    }
}