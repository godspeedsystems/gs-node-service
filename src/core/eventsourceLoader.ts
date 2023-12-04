import path from "path";
import { logger } from "../logger";
import { PlainObject } from "../types";
import loadYaml from "./yamlLoader";
import { GSDataSourceAsEventSource, GSEventSource } from "./_interfaces/sources";
import expandVariables from "./expandVariables"; // Import the expandVariables function

export default async function (eventsourcesFolderPath: string, datasources: PlainObject): Promise<{ [key: string]: GSEventSource | GSDataSourceAsEventSource }> {
  const eventsourcesConfigs = await loadYaml(eventsourcesFolderPath, false);
  if (eventsourcesConfigs && !Object.keys(eventsourcesConfigs).length) {
    throw new Error(`There are no event sources defined in eventsource dir: ${eventsourcesFolderPath}`);
  }

  const eventSources: { [key: string]: GSEventSource | GSDataSourceAsEventSource } = {};

  for await (let esName of Object.keys(eventsourcesConfigs)) {
    // let's load the event source
    logger.debug('evaluating event source %s', esName);
    eventsourcesConfigs[esName] = expandVariables(eventsourcesConfigs[esName]);
    logger.debug(
      'evaluated eventsource %s %o',
      esName,
      eventsourcesConfigs[esName]
    );

    const fileName = eventsourcesConfigs[esName].type;

    await import(path.join(eventsourcesFolderPath, 'types', `${fileName}`)).then(
      async (Module: GSEventSource | GSDataSourceAsEventSource) => {
        const esYamlConfig: PlainObject = eventsourcesConfigs[esName];
        // @ts-ignore
        const Constructor = Module.default;
        let esInstance: GSEventSource | GSDataSourceAsEventSource;

        if ('initClient' in Constructor.prototype) {
          esInstance = new Constructor(esYamlConfig, datasources) as GSEventSource;
          if ('init' in esInstance) {
            await esInstance.init();
          }
        } else {
          let correspondingDatasource = datasources[esName];
          if (!correspondingDatasource) {
            throw new Error(`Corresponding data source for event source ${esName} is not defined.`);
          } else {
            esInstance = new Constructor(esYamlConfig, correspondingDatasource.client) as GSDataSourceAsEventSource;
          }
        }

        eventSources[esName] = esInstance;
      }
    ).catch((error) => {
      logger.error(error);
    });
  }

  return eventSources;
}
