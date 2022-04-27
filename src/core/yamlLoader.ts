import glob from 'glob'
import yaml from 'yaml';
import path from 'path';

import {readFileSync} from 'fs';

import { PlainObject } from "./common"

export default function loadYaml(pathString: string, global: boolean = false):PlainObject {

    let basePath = path.basename(pathString);

    let api: PlainObject = {}

    console.log('parsing files', pathString);

    return new Promise((resolve, reject) => {
      glob(pathString + '/**/*.?(yaml|yml)', function (err:Error|null, res: string[]) {
        console.log('parsing files', res);
        if (err) {
            reject(err)
        } else {
          Promise.all(
            res.map((file:string) => {
                module = yaml.parse(readFileSync(file, { encoding: 'utf-8' }));
                const id = file.replace(new RegExp(`.*?\/${basePath}\/`), '').replace(/\//g, '.').replace(/\.(yaml|yml)/i, '').replace(/\.index$/, '');

                if (global) {
                  api = {
                    ...api,
                    ...module
                  }
                } else {
                  if (id == 'index') {
                      api = module
                  } else {
                      api[id] = module;
                  }
                }
            })
          ).then(() => {
              resolve(api)
          })
        }
      })
    })
}


if (require.main === module) {
   (async () => {
    try {
        await loadYaml('../../dist/events', true).then(console.log);
    } catch(ex) {
        console.error(ex);
    }
   })();
}