
export default async function(args:{[key:string]:any;}) {
    try {
        const ds = args.datasource;
        let res;
        console.log('calling http client', args);

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
        
        return {success: true, code: res.status, data: res.data, message: res.statusText, headers: res.headers};
    } catch(ex) {
        //console.error(ex);
        //@ts-ignore
        let res = ex.response;
        return {success: false, code: res.status, data: res.data, message: (ex as Error).message, headers: res.headers};
    }
}