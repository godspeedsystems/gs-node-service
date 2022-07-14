import { PlainObject } from './common';

import glob from 'glob';
import path from 'path';
import { logger } from './logger';

export default async function loadPluginsDatasources(pathString: string) {
  let basePath = path.basename(pathString);
  let api: PlainObject = {};
  const res = glob.sync(pathString + '/**/*.?(ts|js)');
  logger.info('loadDatasourcePlugins - Loading %s from %s', basePath, pathString);
  logger.debug('loadDatasourcePlugins - files loaded %o', res);

  for (let file of res) {
    const moduleReturn = await require(path.relative(__dirname, file).replace(/\.(ts|js)/, '')).default();
    api = {
      ...api,
      ...moduleReturn
    };
  }
  return api;
}

if (require.main === module) {
  (async () => {
    try {
      await loadPluginsDatasources('../plugins').then(console.log);
    } catch (ex) {
      logger.error(ex);
    }
  })();
}
