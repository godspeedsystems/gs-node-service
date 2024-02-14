import { glob } from 'glob';
import path from 'path';

import { logger } from '../logger';
import { PlainObject } from '../types';
import expandVariables from './expandVariables';
import loadYaml from './yamlLoader';
import { GSDataSource } from './_interfaces/sources';
import { context } from '@opentelemetry/api';

// we need to scan only the first level of datasources folder
export default async function (
  pathString: string
): Promise<{ [key: string]: GSDataSource }> {
  let yamlDatasources = await loadYaml(pathString, false);

  const prismaDatasources = await loadPrismaDsFileNames(pathString);

  const datasourcesConfigs = { ...yamlDatasources, ...prismaDatasources };

  if (datasourcesConfigs && !Object.keys(datasourcesConfigs).length) {
    throw new Error(
      `There are no datasources defined in datasource dir: ${pathString}`
    );
  }
  const datasources: { [key: string]: GSDataSource } = {};

  for await (let dsName of Object.keys(datasourcesConfigs)) {
    logger.debug('evaluating datasource %s', dsName);
    datasourcesConfigs[dsName] = expandVariables(datasourcesConfigs[dsName]);
    logger.debug(
      'evaluated datasource %s %o',
      dsName,
      datasourcesConfigs[dsName]
    );

    // let's load the loadFn and executeFn
    // there is an assumption that for each datasource, the type's .ts file should be inside /datasources/types folder
    const fileName = datasourcesConfigs[dsName].type;
    if (!fileName) {
      logger.warn(`Did not find any datasource 'type' key defined in ${dsName}.yaml. Ignoring this file.`);
      continue;
    }
    await import(path.join(pathString, 'types', `${fileName}`)).then(
      async (Module: GSDataSource) => {
        const dsYamlConfig: PlainObject = datasourcesConfigs[dsName];
        // @ts-ignore
        const Constructor = Module.DataSource || Module.default;
        if (!Constructor) {
          logger.fatal('Expecting datasource %s module file to export GSDataSource under the DataSource or default key', dsName);
        }
        try {
          const dsInstance = new Constructor({ ...dsYamlConfig, name: dsName });
          await dsInstance.init(); // This should initialize and set the client in dsInstance
          if (!dsInstance.client) {
            throw new Error(
              `Client could not be initialized in your datasource ${dsName}`
            );
          }
          datasources[dsName] = dsInstance;

        } catch (error: any) {
          logger.fatal('Error in loading datasource %s \n with config %o \n error %s %o', dsName, dsYamlConfig, error.message, error.stack);
          process.exit(1);
        }

      }
    );
  }
  return datasources;
}

async function loadPrismaDsFileNames(pathString: string): Promise<PlainObject> {
  let basePath = path.basename(pathString);
  let prismaSchemas: PlainObject = {};

  const files = glob.sync(
    path.join(pathString, '**', '*.?(prisma)').replace(/\\/g, '/')
  );
  files.forEach((file: string) => {
    const id = file
      .replace(new RegExp(`.*?\/${basePath}\/`), '')
      .replace(/\//g, '.')
      .replace(/\.(prisma)/i, '')
      .replace(/\.index$/, '');
    prismaSchemas = {
      ...prismaSchemas,
      ...{
        [id]: {
          type: 'prisma',
          name: id,
        },
      },
    };
  });

  return prismaSchemas;
}
