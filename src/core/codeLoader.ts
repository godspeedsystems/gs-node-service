/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
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
                
                if (file.match(/.*?\/plugins\//)) {
                    const id = file
                    .replace(/.*?\/(plugins)\//, '')
                    .replace(/\//g, '_')
                    .replace(/\.(ts|js)/i, '')
                    .replace(/\_index$/, '');

                    // Load plugins at global level to provide backward compatibilty
                    api = { ...api,  ...module };

                    // Load plugins with namespace using underscore notation
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
                          api[id + '_' + f] = module[f];
                        }
                      }
                    }
                } else {
                    const id = file
                    .replace(/.*?\/functions\//, '')
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
      logger.error('Caught exception: %o', (ex as Error).stack);
    }
  })();
}