import { PlainObject } from "./common";

import createAuthRefreshInterceptor from 'axios-auth-refresh';
import { childLogger } from '../app';

async function refreshToken(ds: PlainObject, ctx: any,  failedRequest?: any) {
    const response = await ds.authn(ctx);

    if (response.success) {
        let result = response.data;
        // childLogger.info('response from authn %o', result);
        
        if (result.headers) {
            for (let header in result.headers) {
                ds.client.defaults.headers.common[header] = result.headers[header];
                if (failedRequest) {
                    failedRequest.config.headers[header] = result.headers[header];
                }
            }
        }

        if (result.params) {
            ds.client.defaults.params = ds.client.defaults.params || {};
            for (let param in result.params) {
                ds.client.defaults.params[param] = result.params[param];
                if (failedRequest) {
                    failedRequest.config.params[param] = result.params[param];
                }
            }
        }
        return result;
    }
}


export default async function authnWorkflow(ds: PlainObject, ctx: any) {
    const response = await refreshToken(ds, ctx);

    if (response?.statusCodes) {
        createAuthRefreshInterceptor(ds.client,
            (failedRequest: any) => {
                return refreshToken(ds, ctx, failedRequest);
            },
            {
                statusCodes: response.statusCodes,
                pauseInstanceWhileRefreshing: true,
            }
        );
    }

    return response;
}