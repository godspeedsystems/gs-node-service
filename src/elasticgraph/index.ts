/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { PlainObject } from '../core/common';
import { logger } from '../core/logger';
import ElasticGraph from 'elasticgraph';

export default async function (datasource: PlainObject) {
    if (!datasource) {
      return;
    }

    let client: any;
    logger.debug('elasticgraph datasource: %o', datasource);
    if (datasource.backend_path) {
        client = ElasticGraph(datasource.backend_path);
    }
  
    const ds = {
      ...datasource,
      client,
    };
  
    return ds;
}  
