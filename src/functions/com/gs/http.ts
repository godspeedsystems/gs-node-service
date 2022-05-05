import { logger } from "../../../core/logger";

import FormData from 'form-data'; // npm install --save form-data
import fs from 'fs';
import axiosRetry from 'axios-retry';
import { AxiosError } from 'axios';

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max + 1 - min) + min);
  }

export default async function(args:{[key:string]:any;}) {
    try {
        const ds = args.datasource;
        let res;
        logger.info('calling http client')
        logger.debug('http client baseURL %s',ds.client.baseURL)

        if (ds.schema) {
            logger.info('invoking with schema');
            res = await ds.client.paths[args.config.url][args.config.method](args.params, args.data, args.config)
        } else {
            logger.info('invoking wihout schema');
            logger.debug('invoking wihout schema args: %o', args);
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

            if (args.retry) {
                axiosRetry(ds.client, {
                    retries: args.retry.max_attempts,
                    retryDelay: function(retryNumber: number, error: AxiosError<any, any>) {
                        switch (args.retry.type) {
                            case 'constant':
                                return args.retry.interval * 1000;

                            case 'random':
                                return getRandomInt(args.retry.min_interval, args.retry.max_interval) * 1000;

                            case 'exponential':
                                return axiosRetry.exponentialDelay(retryNumber);
                        }

                        return 0;
                    }
                })
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