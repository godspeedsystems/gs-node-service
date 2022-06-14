import { PlainObject } from './common';

import glob from 'glob';
import path from 'path';
import { logger } from './logger';

export default function loadModules(
  pathString: string,
  global: boolean = false
): PlainObject {
  let api: PlainObject = {};
  logger.info('Loading %s from %s', path.basename(pathString), pathString);

  return new Promise((resolve, reject) => {
    glob(
      pathString + '/**/*.?(ts|js)',
      function (err: Error | null, res: string[]) {
        logger.debug('processing files: %s', res);
        if (err) {
          reject(err);
        } else {
          Promise.all(
            res.map((file: string) => {
              return import(
                path.relative(__dirname, file).replace(/\.(ts|js)/, '')
              ).then((module) => {
                const id = file
                  .replace(/.*?\/(functions|plugins)\//, '')
                  .replace(/\//g, '.')
                  .replace(/\.(ts|js)/i, '')
                  .replace(/\.index$/, '');

                if (global) {
                  api = {
                    ...api,
                    ...module
                  };
                } else {
                  if (id == 'index') {
                    api = {
                      ...api,
                      ...module,
                    };
                  } else {
                    for (let f in module) {
                      if (f == 'default') {
                        api[id] = module[f];
                      } else {
                        api[id + '.' + f] = module[f];
                      }
                    }
                  }
                }
              });
            })
          ).then(() => {
            resolve(api);
          });
        }
      }
    );
  });
}

if (require.main === module) {
  (async () => {
    try {
      await loadModules('../plugins').then(console.log);
    } catch (ex) {
      logger.error(ex);
    }
  })();
}
