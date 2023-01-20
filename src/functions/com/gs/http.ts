/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { logger } from "../../../core/logger";

import FormData from 'form-data'; // npm install --save form-data
import fs from 'fs';

import axiosRetry from 'axios-retry';
import { AxiosError } from 'axios';
import _ from "lodash";
import { PlainObject } from "../../../core/common";
import { HttpMetricsCollector } from 'prometheus-api-metrics';
import { promClient } from '../../../telemetry/monitoring';

// Create southbound_requests_total metrics
const labels = ['route', 'method', 'status_code'];
const southboundCount = new promClient.Counter({
    name: 'southbound_requests_total',
    help: 'Counter for total Southbound queries',
    labelNames: labels
});

HttpMetricsCollector.init({ countClientErrors: true });

function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max + 1 - min) + min);
  }

export default async function(args:{[key:string]:any;}) {
    try {
        const ds = args.datasource;
        let res;
        logger.debug('calling http client with args %o', args);
        logger.debug('http client baseURL %s', ds.client?.defaults?.baseURL);
        logger.info('http client headers %o', { ...ds.client?.defaults?.headers?.common, ...args?.config?.headers});
        logger.info('http client params %o', { ...ds.client?.defaults?.params, ...args?.params});

        if (ds.schema) {
            logger.debug('invoking with schema');
            res = await ds.client.paths[args.config.url][args.config.method](args.params, args.data, args.config);
        } else {
            logger.info('invoking wihout schema');
            logger.debug('invoking wihout schema args: %o', args);
            let form;

            if (args.files) {
                logger.debug('args.files: %o', args.files);
                form = new FormData();

                if (Array.isArray(args.files)) {
                    let files:PlainObject[] = _.flatten(args.files);

                    for (let file of files) {
                        form.append(args.file_key || 'files', fs.createReadStream(file.tempFilePath), {
                            filename: file.name,
                            contentType: file.mimetype,
                            knownLength: file.size
                        });
                    }
                } else if (_.isPlainObject(args.files)) {
                    for (let key in args.files) {
                        let file = args.files[key];
                        if (Array.isArray(file)) {
                            for (let singleFile of file) {
                                form.append(key || 'files', fs.createReadStream(singleFile.tempFilePath), {
                                    filename: singleFile.name,
                                    contentType: singleFile.mimetype,
                                    knownLength: singleFile.size
                                });
                            }
                        } else{
                            form.append(key, fs.createReadStream(file.tempFilePath), {
                                filename: file.name,
                                contentType: file.mimetype,
                                knownLength: file.size
                            });
                        }
                    }
                }

                args.config.headers = {
                    ...(args.config.headers || {}),
                    ...form.getHeaders()
                };

                if (args.data) {
                    for(let k in args.data) {
                        if (args.data[k]) {
                            form.append(k, args.data[k]);
                        }
                    }
                }
            }

            logger.debug('args.retry %s', JSON.stringify(args.retry));

            if (args.retry) {
                axiosRetry(ds.client, {
                    retries: args.retry.max_attempts,
                    retryDelay: function(retryNumber: number, error: AxiosError<any, any>) {
                        logger.debug('called retryDelay function %s', args.retry.type);
                        switch (args.retry.type) {
                            case 'constant':
                                logger.debug('called retryDelay return %s', args.retry.interval);

                                return args.retry.interval;

                            case 'random':
                                return getRandomInt(args.retry.min_interval, args.retry.max_interval);

                            case 'exponential':
                                const delay = 2**retryNumber * args.retry.interval;
                                const randomSum = delay * 0.2 * Math.random(); // 0-20% of the delay
                                return delay + randomSum;
                        }

                        logger.debug('returning retryDelay function with 0');

                        return 0;
                    }
                });
            }

            res = await ds.client({
                ...args.config,
                params: args.params,
                data:  form || args.data
            });
        }

        HttpMetricsCollector.collect(res);

        const route = args.config?.url;
        const method = args.config?.method.toUpperCase();
        const status_code = res.status;
        logger.debug('southbound metric labels route %s method %s status_code %s', route, method, status_code);
        southboundCount.inc({route, method, status_code});

        logger.debug('res: %o', res);
        return {success: true, code: res.status, data: res.data, message: res.statusText, headers: res.headers};
    } catch(ex: any) {
        HttpMetricsCollector.collect(ex);
        logger.error('Caught exception %o', (ex as Error).stack);
        //@ts-ignore
        let res = ex.response;

        if (!res) {
            res = {
                status: 500,
                data: {
                    code: (ex as Error).name,
                    message: (ex as Error).message,
                }
            };
        }

        const route = args.config?.url;
        const method = args.config?.method.toUpperCase();
        const status_code = res.status || ex.status;
        logger.debug('southbound metric labels route %s method %s status_code %s', route, method, status_code);
        southboundCount.inc({route, method, status_code});

        return {success: false, code: res.status, data: res.data, message: (ex as Error).message, headers: res.headers};
    }
}
