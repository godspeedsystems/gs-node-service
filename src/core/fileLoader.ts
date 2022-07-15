import glob from 'glob';
import yaml from 'yaml';
import path from 'path';

import {readFileSync} from 'fs';

import { PlainObject } from "./common";
import { logger } from "./logger";

export default async function loadFiles(pathString: string, file_extension: string, global: boolean = false): Promise<PlainObject> {

  let basePath = path.basename(pathString);

  let api: PlainObject = {};

  logger.info('loadFiles - Loading %s files from %s', basePath, pathString);
  file_extension=file_extension.slice(1);

  return new Promise((resolve, reject) => {  
    glob(`${pathString}/**/*.?(${file_extension})`, function (err:Error|null, res: string[]) {
      logger.debug('loadFiles - parsing files: %s',res);
      if (err) {
          reject(err);
      } else {
        Promise.all(
          res.map((file:string) => {
              module = yaml.parse(readFileSync(file, { encoding: 'utf-8' }));
              let id = file.replace(new RegExp(`.*?\/${basePath}\/`), '').replace(/\//g, '.').replace(new RegExp(`\.${file_extension}$`),'').replace(/\.index$/, '');

              if (global) {
                api = {
                  ...api,
                  ...module
                };
              } else {
                if (id == 'index') {
                    api = module;
                } else {
                    api[id] = module;
                }
              }
          })
        ).then(() => {
            resolve(api);
        });
      }
    });
  });
}


if (require.main === module) {
   (async () => {
    try {
        await loadFiles('../../dist/datasources', '.kafka' , true).then(console.log);
    } catch(ex) {
      logger.error(ex);
    }
   })();
}