import { PlainObject } from './common';
import { logger } from './logger';
import loadYaml from './yamlLoader';
import OpenAPIClientAxios from 'openapi-client-axios';
import axios from 'axios';
import { expandVariable } from './utils';

export default async function loadDatasources(pathString:string) {
    logger.info('Loading datasources')
    const datasources = await loadYaml(pathString, false);

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
                    baseURL: expandVariable(datasources[s].base_url)
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
                                value = expandVariable(value as string);
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
                                auth.username = expandVariable(value[0]);
                                auth.password = expandVariable(value[1]);
                            }
                            else {
                                //@ts-ignore
                                auth.username = expandVariable(value.username);
                                //@ts-ignore
                                auth.password = expandVariable(value.password);
                            }

                            ds[s].client.defaults.auth = auth;
                        }
                        else if (securityScheme.scheme == 'bearer') {
                            ds[s].client.defaults.headers.common['Authorization'] = `Bearer ${expandVariable(value as string)}`;
                        } else {
                            ds[s].client.defaults.headers.common['Authorization'] = `${securityScheme.scheme} ${expandVariable(value as string)}`;
                        }
                    }
                }
            }
        }
    }

    return ds
}