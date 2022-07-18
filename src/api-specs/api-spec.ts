import loadYaml from '../core/yamlLoader';
import yaml from 'yaml';
import { PlainObject } from '../core/common';
import { logger } from '../core/logger';
import fs from 'fs-extra';
import { removeNulls, PROJECT_ROOT_DIRECTORY } from '../core/utils';
import swaggerCommonPart from './basic-spec';

export default async function generateSchema(
  eventsFolderPath: string
): Promise<PlainObject> {
  const eventsSchema: PlainObject = await loadEventsYaml(eventsFolderPath);
  const finalSpec = JSON.parse(JSON.stringify(swaggerCommonPart)); //Make a deep clone copy

  Object.keys(eventsSchema).forEach((event: any) => {
    let apiEndPoint = event.split('.')[0];
    apiEndPoint = apiEndPoint.replaceAll(/:([^\/]+)/g, '{$1}'); //We take :path_param. OAS3 takes {path_param}
    const method = event.split('.')[2];
    const eventSchema = eventsSchema[event];

    //Initialize the schema for this method, for given event
    let methodSpec: PlainObject = {
      summary: eventSchema.summary,
      description: eventSchema.description,
      requestBody: eventSchema.body || eventSchema.data?.schema?.body,
      parameters: eventSchema.params || eventSchema.data?.schema?.params,
      responses: eventSchema.responses,
    };

    //Set it in the overall schema
    finalSpec.paths[apiEndPoint] = {
      ...finalSpec.paths[apiEndPoint],
      [method]: methodSpec,
    };
  });
  removeNulls(finalSpec);
  return finalSpec;
}
async function loadEventsYaml(path: string) {
  try {
    return await loadYaml(path, true);
  } catch (ex) {
    logger.error('Error in reading events YAMLs', ex);
    process.exit(1);
  }
}

if (require.main === module) {
  const eventPath = '/workspace/development/app/src/events';
  generateSchema(eventPath)
    .then((schema) => {
      fs.outputFile(
        '/workspace/development/app/docs/api-doc.yaml',
        yaml.stringify(schema),
        (err) => {
          if (err) {
            logger.error(
              'Error in generating /workspace/development/app/docs/api-doc.yaml file %o',
              err
            );
          } else {
            logger.info(
              '/workspace/development/app/docs/api-doc.yaml file is saved!'
            );
          }
        }
      );
    })
    .catch((e) => {
      logger.error('Error: %o', e);
    });
}
