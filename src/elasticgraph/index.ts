/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { PlainObject } from '../core/common';
import { logger } from '../core/logger';
const ElasticGraph = require('../../elasticgraph');

export default async function (datasource: PlainObject) {
    if (!datasource) {
      return;
    }

    let client: any;
    logger.debug('elasticgraph datasource: %o', datasource);
    if (datasource.schema_backend) {
        client = ElasticGraph(datasource.schema_backend);
    }
  
    const ds = {
      ...datasource,
      client,
    };
  
    return ds;
}
