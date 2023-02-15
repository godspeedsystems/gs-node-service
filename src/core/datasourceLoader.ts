/*
 * You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
 * © 2022 Mindgrep Technologies Pvt Ltd
 */
import OpenAPIClientAxios from 'openapi-client-axios';
import axios from 'axios';
import path from 'path';
import { fieldEncryptionMiddleware } from '@mindgrep/prisma-deterministic-search-field-encryption';
import { Buffer } from 'buffer';
import crypto from 'crypto';
import { logger } from './logger';
import loadYaml from './yamlLoader';
import { PlainObject } from './common';
import { config as appConfig } from './loader';
import glob from 'glob';
import { compileScript, PROJECT_ROOT_DIRECTORY } from './utils';
import KafkaMessageBus from '../kafka';
import loadAWSClient from '../aws';
import loadRedisClient from '../redis';
import loadElasticgraphClient from '../elasticgraph';
import {
  isValidApiDatasource,
  isValidRedisDatasource,
  isValidKafkaDatasource,
  isValidElasticgraphDatasource,
} from './validation';
import config from 'config';
const axiosTime = require('axios-time');

const secret = (config as any).prisma_secret || 'prismaEncryptionSecret';
const password_hash = crypto
  .createHash('md5')
  .update(secret, 'utf-8')
  .digest('hex')
  .toUpperCase();
const iv = Buffer.alloc(16);

export default async function loadDatasources(pathString: string) {
  logger.info('Loading datasources');

  let yamlDatasources = await loadYaml(pathString, false);
  const prismaDatasources = await loadPrismaDsFileNames(pathString);
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
    logger.info('evaluating datasource: %s', ds);

    let datasourceScript = compileScript(datasources[ds]);
    datasources[ds] = datasourceScript(config, {}, {}, appConfig.app.mappings, {});
    logger.info('evaluated datasource %s: %o', ds, datasources[ds]);

    if (datasources[ds].type === 'api') {
      if (isValidApiDatasource(datasources[ds])) {
        loadedDatasources[ds] = await loadHttpDatasource(datasources[ds]);
      } else {
        process.exit(1);
      }
    } else if (datasources[ds].type === 'datastore') {
      loadedDatasources[ds] = await loadPrismaClient(
        pathString + '/generated-clients/' + ds
      );
    } else if (datasources[ds].type === 'kafka') {
      if (isValidKafkaDatasource(datasources[ds])) {
        loadedDatasources[ds] = await loadKafkaClient(datasources[ds]);
      } else {
        process.exit(1);
      }
    } else if (datasources[ds].type === 'redis') {
      if (isValidRedisDatasource(datasources[ds])) {
        loadedDatasources[ds] = await loadRedisClient(datasources[ds]);
      } else {
        process.exit(1);
      }
    } else if (datasources[ds].type === 'elasticgraph') {
      if (isValidElasticgraphDatasource(datasources[ds])) {
        loadedDatasources[ds] = await loadElasticgraphClient(datasources[ds]);
      } else {
        process.exit(1);
      }
    } else if (datasources[ds].type === 'aws') {
      loadedDatasources[ds] = await loadAWSClient(datasources[ds]);
    } else if (datasources[ds].type) {
      //some other type
      if (datasources[ds].loadFn) {
        //check if loadFn is present in the datasource YAML

        const fnPath = datasources[ds].loadFn.replace(/\./g, '/');
        const loadFn = await import(
          path.relative(
            __dirname,
            PROJECT_ROOT_DIRECTORY + '/functions/' + fnPath
          )
        );
        loadedDatasources[ds] = await loadFn.default(datasources[ds]);

        logger.debug('Loaded non core datasource: %o', loadedDatasources[ds]);
      } else {
        logger.error(
          'No loader found for datasource %s and type %s',
          ds,
          datasources[ds].type
        );
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
  let ds = datasource;

  if (datasource.schema) {
    const api = new OpenAPIClientAxios({ definition: datasource.schema });
    api.init();
    ds.client = await api.getClient();
  } else {
    ds.client = axios.create({ baseURL: datasource.base_url });

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
              ds.client.defaults.headers.common[securityScheme.name] = <any>(
                value
              );
              logger.debug('Adding header %s: %s', securityScheme.name, value);
            } catch (ex) {
              //console.error(ex);
              logger.error('Caught exception %o', (ex as Error).stack);
            }
          }
        } else if (securityScheme.type == 'http') {
          if (securityScheme.scheme == 'basic') {
            let auth = { username: '', password: '' };
            if (Array.isArray(value)) {
              auth.username = value[0];
              auth.password = value[1];
            } else {
              //@ts-ignore
              auth.username = value.username;
              //@ts-ignore
              auth.password = value.password;
            }

            ds.client.defaults.auth = auth;
          } else if (securityScheme.scheme == 'bearer') {
            ds.client.defaults.headers.common.Authorization = `Bearer ${value}`;
          } else {
            ds.client.defaults.headers.common.Authorization = `${securityScheme.scheme} ${value}`;
          }
        }
      }
    }
  }

  axiosTime(ds.client);
  return ds;
}

async function loadPrismaClient(pathString: string): Promise<PlainObject> {
  const { Prisma, PrismaClient } = require(pathString);
  const prisma = new PrismaClient();
  await prisma.$connect();
  prisma.$use(
    fieldEncryptionMiddleware({
      encryptFn: (decrypted: any) => cipher(decrypted),
      decryptFn: (encrypted: string) => decipher(encrypted),
      dmmf: Prisma.dmmf,
    })
  );
  return {
    client: prisma,
    //any other config params
  };
}

async function loadKafkaClient(datasource: PlainObject): Promise<PlainObject> {
  const ds = {
    ...datasource,
    client: new KafkaMessageBus(datasource),
  };
  return ds;
}

function cipher(decrypted: any) {
  const cipher = crypto.createCipheriv('aes-256-gcm', password_hash, iv);
  return cipher.update(decrypted, 'utf-8', 'hex');
}

function decipher(encrypted: string) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', password_hash, iv);
  return decipher.update(encrypted, 'hex', 'utf-8');
}
