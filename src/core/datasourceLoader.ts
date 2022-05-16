import OpenAPIClientAxios from 'openapi-client-axios';
import axios from 'axios';
import { logger } from './logger';
import loadYaml from './yamlLoader';
import { PlainObject } from './common';
import expandVariables from './expandVariables';

export default async function loadDatasources() {
  logger.info('Loading datasources')
  const datasources = await loadYaml(__dirname + '/datasources', false);

  logger.debug('Loaded datasources %o',datasources)
  logger.info('Loaded datasources: %s',Object.keys(datasources))

  const ds:PlainObject = {}

  for (let s in datasources) {
      const security = datasources[s].security;
      const securitySchemes = datasources[s].securitySchemes;

      //TODO: Expand all the variables in a datasource
      if (datasources[s].schema) {
          const api = new OpenAPIClientAxios({definition: datasources[s].schema});
          api.init();
          ds[s] =  {
              client: await api.getClient(),
              schema: true,
          }
      } else {
          ds[s] =  {
              client: axios.create({
                  baseURL: expandVariables(datasources[s].base_url)
              }),
              schema: false
          };

          logger.debug('security %o',security)

          if (security && security.length) {
              for (let values of security) {

                  let [scheme, value] = Object.entries(values)[0];
                  let securityScheme = securitySchemes[scheme];

                  if(securityScheme.type == 'apiKey') {
                      if (securityScheme.in == 'header') {
                          try {
                              value = expandVariables(value as string);
                              ds[s].client.defaults.headers.common[securityScheme.name] = value;
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

                          ds[s].client.defaults.auth = auth;
                      }
                      else if (securityScheme.scheme == 'bearer') {
                          ds[s].client.defaults.headers.common['Authorization'] = `Bearer ${expandVariables(value as string)}`;
                      } else {
                          ds[s].client.defaults.headers.common['Authorization'] = `${securityScheme.scheme} ${expandVariables(value as string)}`;
                      }
                  }
              }
          }
      }
  }

  return ds
}
