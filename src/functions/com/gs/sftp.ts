import { GSStatus } from "../../../core/interfaces";
import { logger } from "../../../core/logger";


export default async function sftp(args:{[key:string]:any;}) {
    
    logger.debug('com.gs.sftp args: %o', args);

    const options = args.datasource.options;

    const ds = args.datasource;

    let method = ds.client[args.config.method];

    try {
 
      await ds.client.connect(options);
      
      const res = await method.bind(ds.client)(args.params);

      await ds.client.end();

      return new GSStatus(true, 200, undefined, res);

    } catch (err) {

      return new GSStatus(false, 400, err.message || 'Error in sftp method', JSON.stringify(err.stack));

    }
}