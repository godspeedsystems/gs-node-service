import glob from 'glob';
import yaml from 'yaml';
import path from 'path';

import {readFileSync} from 'fs';

import { PlainObject } from "./common";
import { logger } from "./logger";

export default function loadYaml(pathString: string, global: boolean = false):PlainObject {

    let basePath = path.basename(pathString);

    let api: PlainObject = {};

    logger.info('loadYaml - Loading %s from %s', basePath, pathString);

    return new Promise((resolve, reject) => {
      glob(pathString + '/**/*.?(yaml|yml)', function (err:Error|null, res: string[]) {
        logger.debug('loadYaml - parsing files: %s',res);
        if (err) {
            reject(err);
        } else {
          Promise.all(
            res.map((file:string) => {
                module = yaml.parse(readFileSync(file, { encoding: 'utf-8' }));
                const id = file.replace(new RegExp(`.*?\/${basePath}\/`), '').replace(/\//g, '.').replace(/\.(yaml|yml)/i, '').replace(/\.index$/, '');

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
        await loadYaml('../../dist/events', true).then(console.log);
    } catch(ex) {
      logger.error(ex);
    }
   })();
}