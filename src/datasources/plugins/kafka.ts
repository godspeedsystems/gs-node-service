//Every datasource will have type field. And anything else required for its functions to execute.

import glob from 'glob';
import yaml from 'yaml';
import path from 'path';
import {readFileSync} from 'fs';

import { PlainObject } from "../../core/common";
import { PROJECT_ROOT_DIRECTORY } from '../../core/utils';
import { logger } from '../../core/logger';
// EXAMPLE enum DS_TYPES {
//     REST,
//     datastore,
//     message_bus,
//     soap,
//     graphQl,
//     gRpc
// }
interface Datasource {
    type: string, //The type of the datastore
    file_extension: string, //The file extension which uniquely identifies this datastore
    loader(file_extension: string)//Loading function for the file extension
}

let datasource: Datasource = {
    type: 'message_bus',
    file_extension: '.kafka',
    loader(file_extension: string) {
        const pathString = PROJECT_ROOT_DIRECTORY + '/datasources';
        const files = loadDSSpecificFile(pathString, file_extension, false); 
        logger.debug('files: %o', files);
        return {
            //name: 'client1'
        };
        // return {
        //     name: file.split('.')[0], //read from the name of the file
        //     client: ''//kafka_client from the file data
        // };        
    } //return the JSON for this datasource
};

export function loadDSSpecificFile(pathString: string, file_extension: string, global: boolean=false):PlainObject {

    let basePath = path.basename(pathString);

    let api: PlainObject = {};

    logger.info('Loading %s from %s', basePath, pathString);

    return new Promise((resolve, reject) => {
      glob(pathString + '/**/*.?(' + file_extension + ')', function (err:Error|null, res: string[]) {
        logger.debug('parsing files: %s',res);
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

export { datasource };
