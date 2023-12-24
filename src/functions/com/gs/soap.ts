import { GSStatus } from "../../../core/interfaces";
import { logger } from "../../../core/logger";


export default async function soap(args:{[key:string]:any;}) {
    logger.debug('com.gs.soap args: %o', args);
    const ds = args.datasource;

    let method = ds.client[args.config.method + 'Async'];

    if (args.config.headers) {
        for (let key in args.config.headers) {
            ds.client.addHttpHeader(key, args.config.headers[key]);
        }
    }

    try {
      const res = await method.bind(ds.client)(args.data);
      return new GSStatus(true, 200, undefined, res);
    } catch (err) {
      return new GSStatus(false, 400, err.message || 'Error in soap method', JSON.stringify(err.stack));
    }
}