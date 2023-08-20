import { glob } from "glob";
import path from "path";
import config from 'config';

import { logger } from "../logger";
import { PlainObject } from "../types";
import expandVariables from './expandVariables';
import loadYaml from "./yamlLoader";
import loadMappings from "./mappingLoader";


// we need to scan only the first level of datasources folder
export default async function (pathString: string): Promise<PlainObject> {
  let yamlDatasources = await loadYaml(pathString, false);

  const prismaDatasources = await loadPrismaDsFileNames(pathString);
  const datasources = { ...yamlDatasources, ...prismaDatasources };

  const mappings = loadMappings();

  for (let ds in datasources) {
    logger.debug('evaluating datasource %s', ds);
    datasources[ds] = expandVariables(datasources[ds]);
    logger.debug('evaluated datasource %s %o', ds, datasources[ds]);

    // let's load the loadFn and executeFn
    // there is an assumption that for each datasource, type file should be inside /definitions folder
    const fileName = datasources[ds]?.type;

    await import(path.join(pathString, 'definitions', `${fileName}`)).then(async (module) => {
      const datasource = datasources[ds];
      if (!module.hasOwnProperty('initFn') && typeof module.initFn !== 'function') {
        logger.error('initFn for the datasource of type %s is not specified, or it is not a function.', datasource.type);
      } else {
        let client = await module.initFn({ ...datasource, dsName: ds }, { config, mappings, logger });
        datasources[ds].client = client;
      }

      if (!module.hasOwnProperty('executeFn') && typeof module.executeFn !== 'function') {
        logger.error('executeFn for the datasource of type %s is not specified, or it is not a function.', datasource.type);
      } else {
        let executeFn = module.executeFn;
        datasources[ds].executeFn = executeFn;
      }
    });
  };

  return datasources;
}

async function loadPrismaDsFileNames(pathString: string): Promise<PlainObject> {
  let basePath = path.basename(pathString);
  let prismaSchemas: PlainObject = {};

  const files = glob.sync(pathString + '/**/*.?(prisma)');

  files.forEach((file: string) => {
    if (file.includes('generated-client')) {
      return;
    }
    const id = file
      .replace(new RegExp(`.*?\/${basePath}\/`), '')
      .replace(/\//g, '.')
      .replace(/\.(prisma)/i, '')
      .replace(/\.index$/, '');
    prismaSchemas = {
      ...prismaSchemas,
      ...{
        [id]: {
          type: 'datastore',
        },
      },
    };
  });

  return prismaSchemas;


  // return new Promise((resolve, reject) => {
  //   glob(
  //     pathString + '/**/*.?(prisma)',
  //     function (err: Error | null, res: string[]) {
  //       logger.debug('loaded prisma files: %s', res);
  //       if (err) {
  //         reject(err);
  //       } else {
  //         res.forEach((file: string) => {
  //           if (file.includes('generated-client')) {
  //             return;
  //           }
  //           const id = file
  //             .replace(new RegExp(`.*?\/${basePath}\/`), '')
  //             .replace(/\//g, '.')
  //             .replace(/\.(prisma)/i, '')
  //             .replace(/\.index$/, '');
  //           prismaSchemas = {
  //             ...prismaSchemas,
  //             ...{
  //               // For now all datastores are Prisma stores only. Till we integrate Elasticsearch
  //               [id]: {
  //                 type: 'datastore',
  //               },
  //             },
  //           };
  //         });
  //         resolve(prismaSchemas);
  //       }
  //     }
  //   );
  // });
}