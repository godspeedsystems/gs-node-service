
import FormData from 'form-data'; // npm install --save form-data
import fs from 'fs';

export default async function(args:{[key:string]:any;}) {
    try {
        const ds = args.datasource;
        let res;
        console.log('calling http client', ds.client.baseURL);

        if (ds.schema) {
            console.log('invoking with schema');
            res = await ds.client.paths[args.config.url][args.config.method](args.params, args.data, args.config)
        } else {
            console.log('invoking wihout schema', args);
            let form;

            if (args.files) {
                form = new FormData();

                for (let file of args.files) {
                    form.append(args.file_key || 'files', fs.createReadStream(file.tempFilePath), {
                        filename: file.name,
                        contentType: file.mimetype,
                        knownLength: file.size
                    });
                }

                args.config.headers = {
                    ...(args.config.headers || {}),
                    ...form.getHeaders()
                }

                if (args.data) {
                    for(let k in args.data) {
                        form.append(k, args.data[k]);
                    }
                }
            }

            res = await ds.client({
                ...args.config,
                params: args.params,
                data:  form || args.data
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