import { PlainObject } from "./common";

import createAuthRefreshInterceptor from 'axios-auth-refresh';

async function refreshToken(ds: PlainObject, ctx: any,  failedRequest?: any) {
    const response = await ds.authn(ctx);
    if (response.headers) {
        for (let header in response.headers) {
            ds.client.defaults.headers.common[header] = response.headers[header];
            failedRequest.request.config.headers[header] = response.headers[header];
        }
    }

    if (response.params) {
        for (let param in response.params) {
            ds.client.defaults.params[param] = response.params[param];
            failedRequest.request.config.params[param] = response.params[param];
        }
    }
 
    return response;
}


export default async function authnWorkflow(ds: PlainObject, ctx: any) {
    const response = await refreshToken(ds, ctx);

    if (response.statusCodes) {
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