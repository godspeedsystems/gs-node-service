import { PlainObject } from "./common"

import glob from 'glob'

export default function loadModules(path: string):PlainObject {

    let api: PlainObject = {}

    return new Promise((resolve, reject) => {
      glob(path + '/**/*.?(ts|js)', function (err:Error|null, res: string[]) {
        if (err) {
            reject(err)
        } else {
          Promise.all(
            res.map((file:string) => {
              return import(file.replace(__dirname, '.').replace(/\.(ts|js)/, ''))
              .then(module => {
                const id = file.replace(path + '/', '').replace(/\//g, '.').replace(/\.(ts|js)/, '').replace(/\.index$/, '');

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