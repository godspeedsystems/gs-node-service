import path from "path";
import { logger } from "../logger";
import { PlainObject } from "../types";
import loadYaml from "./yamlLoader";
import config from "config";
import { GSEventSource } from "./_interfaces/sources";

export default async function (eventsourcesFolderPath: string, datasources: PlainObject): Promise<{ [key: string]: GSEventSource }> {
  logger.info('eventsourcesFolderPath %s', eventsourcesFolderPath);
  logger.info('datasources %o', datasources);

  const eventsourcesConfigs = await loadYaml(eventsourcesFolderPath, false);
  const eventSources: { [key: string]: GSEventSource } = {};

  for await (let esName of Object.keys(eventsourcesConfigs)) {
    let correspondingDatasource = datasources[esName]; //By design, datasource and event source need to share the same name.

    if (!correspondingDatasource) {
      throw new Error(`Corresponding datasource for eventsource ${esName} is not defined. Please ensure a datasource type exists with the same file name in /datasources directory`);
    } else {
      // let's load the event source
      const eventSourceType = eventsourcesConfigs[esName].type;
      await import(path.join(eventsourcesFolderPath, 'types', eventSourceType))
        .catch((err) => {
          logger.error(`Error in importing the event source type ${eventSourceType} for eventsource ${esName}. Error message ${err.message}`);
          throw err;
        })
        .then(async (Module) => {
          //@ts-ignore
          const eventSourceInstance: GSEventSource = new Module.default(config, correspondingDatasource); // eslint-disable-line
          eventSources[esName] = eventSourceInstance;
        });
    }
  }

  return eventSources;
};