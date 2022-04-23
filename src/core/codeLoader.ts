import { PlainObject } from "./common"

import glob from 'glob'
import path from 'path';

export default function loadModules(pathString: string):PlainObject {

    let api: PlainObject = {}

    return new Promise((resolve, reject) => {
      glob(pathString + '/**/*.?(ts|js)', function (err:Error|null, res: string[]) {
        console.log('processing files', res);
        if (err) {
            reject(err)
        } else {
          Promise.all(
            res.map((file:string) => {
              return import(path.relative(__dirname, file).replace(/\.(ts|js)/, ''))
              .then(module => {
                const id = file.replace(/.*?\/(functions|plugins)\//, '').replace(/\//g, '.')
                  .replace(/\.(ts|js)/i, '').replace(/\.index$/, '');

                if (id == 'index') {
                    api = {
                        ...api,
                        ...module
                    }
                } else {
                    for (let f in module) {
                        if (f == 'default') {
                            api[id] = module[f]
                        } else {
                            api[id + '.' + f] = module[f]
                        }
                    }
                }
              })
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
        await loadModules('../plugins').then(console.log);
    } catch(ex) {
        console.error(ex);
    }
   })();
}