/*
 * You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
 * © 2022 Mindgrep Technologies Pvt Ltd
 */
import { PlainObject } from '../core/common';
import { logger } from '../core/logger';

export default async function (datasource: PlainObject) {
  // @ts-ignore
  if (!datasource) {
    return;
  }

  let client: any = {};

  for (let service in datasource.services) {
    let module = await import('@aws-sdk/client-' + service.toLowerCase());
    client[service] = new module[service]({
      ...datasource.common,
      ...(datasource.services[service]?.config || {})
    });
  }

  const ds = {
    ...datasource,
    client,
  };

  return ds;
}