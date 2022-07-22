import OpenAPIClientAxios from 'openapi-client-axios';
import axios from 'axios';
import path from 'path';
import { logger } from './logger';
import loadYaml from './yamlLoader';
import { PlainObject } from './common';
import expandVariables from './expandVariables';
import glob from 'glob';
import { compileScript, PROJECT_ROOT_DIRECTORY } from './utils';
import KafkaMessageBus from '../kafka';
import config from 'config';

export default async function loadDatasources(pathString:string) {
  logger.info('Loading datasources');

  let yamlDatasources = await loadYaml(
    pathString,
    false
  );
  const prismaDatasources = await loadPrismaDsFileNames(
    pathString
  );
  const datasources = {
    ...yamlDatasources,
    ...prismaDatasources,
  };
  logger.debug(
    'Loaded datasources yaml %o prisma %o',
    yamlDatasources,
    prismaDatasources
  );
  logger.info('Loaded datasources: %s', Object.keys(datasources));

  const loadedDatasources: PlainObject = {};

  for (let ds in datasources) {
    if (datasources[ds].type === 'api') {
      loadedDatasources[ds] = await loadHttpDatasource(datasources[ds]);
    } else if (datasources[ds].type === 'datastore') {
      loadedDatasources[ds] = await loadPrismaClient(pathString + '/generated-clients/' + ds);
    } else if (datasources[ds].type === 'kafka') {
      loadedDatasources[ds] = await loadKafkaClient(datasources[ds]);
    } else if (datasources[ds].type) { //some other type
      if (datasources[ds].loadFn) { //check if loadFn is present in the datasource YAML
        // Expand config variables
        for (let key in datasources[ds]) {
          datasources[ds][key] = expandVariables(datasources[ds][key]);
        }

        const fnPath = datasources[ds].loadFn.replace(/\./g,'/');
        const loadFn = await import(path.relative(__dirname, PROJECT_ROOT_DIRECTORY + '/functions/' + fnPath));
        const finalDatasource = await loadFn.default(datasources[ds]);
        
        // Here we are going to check the datasource object, if it contains <% %> then create datasourceScript
        // and load the datasourceScript else just load the datasource object.
        let datasourceScript;
        const strDatasource = JSON.stringify(finalDatasource);

        if (strDatasource.match(/<(.*?)%/) && strDatasource.includes('%>')) {
          datasourceScript = compileScript(finalDatasource);
          logger.debug('datasourceScript: %s',datasourceScript);
          loadedDatasources[ds] = datasourceScript;
        } else {
          loadedDatasources[ds] = finalDatasource;
        }
        logger.debug('Loaded non core datasource: %o',loadedDatasources[ds]);
      } else {
        logger.error('No loader found for datasource %s and type %s', ds, datasources[ds].type);  
        process.exit(1);
      }
    } else {
      logger.error(
        'Found datasource without any type for the datasource %s. Must specify type in the datasource. Exiting.',
        ds
      );
      process.exit(1);
    }
  }
  logger.info('Finally loaded datasources: %s', Object.keys(datasources));
  return loadedDatasources;
}
async function loadPrismaDsFileNames(pathString: string): Promise<PlainObject> {
  let basePath = path.basename(pathString);
  let prismaSchemas: PlainObject = {};
  return new Promise((resolve, reject) => {
    glob(
      pathString + '/**/*.?(prisma)',
      function (err: Error | null, res: string[]) {
        logger.debug('loaded prisma files: %s', res);
        if (err) {
          reject(err);
        } else {
          res.forEach((file: string) => {
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
                //For now all datastores are Prisma stores only. Till we integrate Elasticsearch
                [id]: {
                  type: 'datastore',
                },
              },
            };
          });
          resolve(prismaSchemas);
        }
      }
    );
  });
}
async function loadHttpDatasource(
  datasource: PlainObject
): Promise<PlainObject> {

  if (datasource.schema) {
    const api = new OpenAPIClientAxios({ definition: datasource.schema });
    api.init();
    return {
      ...datasource,
      client: await api.getClient(),
      schema: true,
    };
  } else {
    const ds = {
      ...datasource,
      client: axios.create({
        baseURL: expandVariables(datasource.base_url),
      }),
      schema: false,
    };

    const security = datasource.security;
    const securitySchemes = datasource.securitySchemes;
    logger.debug('security %o', security);

    if (security && security.length) {
      for (let values of security) {
        let [scheme, value] = Object.entries(values)[0];
        let securityScheme = securitySchemes[scheme];

        if (securityScheme.type == 'apiKey') {
          if (securityScheme.in == 'header') {
            try {
              value = expandVariables(value as string);
              ds.client.defaults.headers.common[securityScheme.name] = <any>(
                value
              );
              logger.debug('Adding header %s: %s', securityScheme.name, value);
            } catch (ex) {
              //console.error(ex);
              logger.error(ex);
            }
          }
        } else if (securityScheme.type == 'http') {
          if (securityScheme.scheme == 'basic') {
            let auth = { username: '', password: '' };
            if (Array.isArray(value)) {
              auth.username = expandVariables(value[0]);
              auth.password = expandVariables(value[1]);
            } else {
              //@ts-ignore
              auth.username = expandVariables(value.username);
              //@ts-ignore
              auth.password = expandVariables(value.password);
            }

            ds.client.defaults.auth = auth;
          } else if (securityScheme.scheme == 'bearer') {
            ds.client.defaults.headers.common.Authorization = `Bearer ${expandVariables(
              value as string
            )}`;
          } else {
            ds.client.defaults.headers.common.Authorization = `${
              securityScheme.scheme
            } ${expandVariables(value as string)}`;
          }
        }
      }
    }
    return ds;
  }
}

async function loadPrismaClient(pathString: string): Promise<PlainObject> {
  const { PrismaClient } = require(pathString);
  const prisma = new PrismaClient();
  await prisma.$connect();
  return {
    client: prisma,
    //any other config params
  };
}

async function loadKafkaClient(datasource: PlainObject): Promise<PlainObject> {
  const ds = {
    ...datasource,
    client: new KafkaMessageBus(datasource)
  };
  return ds;
}
