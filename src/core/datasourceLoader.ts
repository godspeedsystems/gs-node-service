import OpenAPIClientAxios from 'openapi-client-axios';
import axios from 'axios';
import path from 'path';
import { logger } from './logger';
import loadYaml from './yamlLoader';
import { PlainObject } from './common';
import expandVariables from './expandVariables';
import glob from 'glob';

export default async function loadDatasources() {
  logger.info('Loading datasources')
  let datasources = await loadYaml(__dirname + '/datasources', false);
  const prismaDatasources = await loadPrismaDsFileNames(__dirname + '/datasources');
  datasources = {
    ...datasources,
    ...prismaDatasources
  }
  logger.debug('Loaded datasources %o',datasources)
  logger.info('Loaded datasources: %s',Object.keys(datasources))

  const loadedDatasources:PlainObject = {}

  for (let ds in datasources) {
    if (datasources[ds].type === 'api') {
      loadedDatasources[ds] = await loadHttpDatasource(datasources[ds]);
    } else if (datasources[ds].type === 'datastore') {
      loadedDatasources[ds] = await loadPrismaClient(ds);
    } else {
      logger.error('Found invalid datasource type %s for the datasource %s. Ignoring it.',datasources[ds].type, ds)
    }

      //TODO: Expand all the variables in a datasource
      
  }

  return loadedDatasources
}
async function loadPrismaDsFileNames (pathString: string): Promise<PlainObject> {
  let basePath = path.basename(pathString);
  let prismaSchemas: PlainObject = {}
  return new Promise((resolve, reject) => {
    glob(pathString + '/**/*.?(prisma)', function (err:Error|null, res: string[]) {
      logger.debug('loaded prisma files: %s',res)
      if (err) {
          reject(err)
      } else {
        Promise.all(
          res.map((file:string) => {
              const id = file.replace(new RegExp(`.*?\/${basePath}\/`), '').replace(/\//g, '.').replace(/\.(yaml|yml)/i, '').replace(/\.index$/, '');
              prismaSchemas = {
                ...prismaSchemas,
                ...{//For now all datastores are Prisma stores only. Till we integrate Elasticsearch
                  [id]: {
                    type: 'datastore'
                  }, 
                }
              }
          })
        ).then(() => {
            resolve(prismaSchemas)
        })
      }
    })
  })
}
async function loadHttpDatasource (datasource: PlainObject): Promise<PlainObject> {
  if (datasource.schema) {
    const api = new OpenAPIClientAxios({definition: datasource.schema});
    api.init();
    return {
        client: await api.getClient(),
        schema: true,
    }
} else {
   const ds = {
        client: axios.create({
            baseURL: expandVariables(datasource.base_url)
        }),
        schema: false
    };

    const security = datasource.security;
    const securitySchemes = datasource.securitySchemes;
    logger.debug('security %o',security)

    if (security && security.length) {
        for (let values of security) {

            let [scheme, value] = Object.entries(values)[0];
            let securityScheme = securitySchemes[scheme];

            if(securityScheme.type == 'apiKey') {
                if (securityScheme.in == 'header') {
                    try {
                        value = expandVariables(value as string);
                        ds.client.defaults.headers.common[securityScheme.name] = <any> value;
                        logger.debug('Adding header %s: %s',securityScheme.name,value)
                    } catch(ex) {
                        //console.error(ex);
                        logger.error(ex);
                    }
                }
            }
            else if(securityScheme.type == 'http') {
                if (securityScheme.scheme == 'basic') {
                    let auth = {username: '', password: ''};
                    if (Array.isArray(value)) {
                        auth.username = expandVariables(value[0]);
                        auth.password = expandVariables(value[1]);
                    }
                    else {
                        //@ts-ignore
                        auth.username = expandVariables(value.username);
                        //@ts-ignore
                        auth.password = expandVariables(value.password);
                    }

                    ds.client.defaults.auth = auth;
                }
                else if (securityScheme.scheme == 'bearer') {
                    ds.client.defaults.headers.common['Authorization'] = `Bearer ${expandVariables(value as string)}`;
                } else {
                    ds.client.defaults.headers.common['Authorization'] = `${securityScheme.scheme} ${expandVariables(value as string)}`;
                }
            }
        }
    }
    return ds;
}
}

async function loadPrismaClient (dsName: String): Promise<PlainObject> {
  const PrismaClient = require(__dirname + '/datasources/generated-prisma-clients/' + dsName);
  const prisma = new PrismaClient();
  await prisma.$connect();
  return {
    client: prisma,
    //any other config params
  }
}
