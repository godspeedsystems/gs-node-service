import glob from 'glob'
import yaml from 'yaml';

import {readFileSync} from 'fs';

import { PlainObject } from "./common"

export default function loadYaml(path: string, global: boolean = false):PlainObject {

    let api: PlainObject = {}

    console.log('parsing files', path);

    return new Promise((resolve, reject) => {
      glob(path + '/**/*.?(yaml|yml)', function (err:Error|null, res: string[]) {
        console.log('parsing files', res);
        if (err) {
            reject(err)
        } else {
          Promise.all(
            res.map((file:string) => {
                module = yaml.parse(readFileSync(file, { encoding: 'utf-8' }));
                const id = file.replace(/.*?\/functions\//, '').replace(/\//g, '.').replace(/\.(yaml|yml)/i, '').replace(/\.index$/, '');

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