import path from "path";
import { logger } from "../logger";
import { PlainObject } from "../types";
import loadYaml from "./yamlLoader";
import { GSDatasourceAsEventSource, GSEventSource } from "./_interfaces/sources";

export default async function (eventsourcesFolderPath: string, datasources: PlainObject): Promise<{ [key: string]: GSEventSource | GSDatasourceAsEventSource }> {
  logger.debug('eventsourcesFolderPath %s', eventsourcesFolderPath);
  logger.debug('Datasources %o', Object.keys(datasources));

  const eventsourcesConfigs = await loadYaml(eventsourcesFolderPath, false);
  const eventSources: { [key: string]: GSEventSource | GSDatasourceAsEventSource } = {};

  for await (let esName of Object.keys(eventsourcesConfigs)) {
    // let's load the event source
    const eventSourceConfig = eventsourcesConfigs[esName];
    try {
      const Module = await import(path.join(eventsourcesFolderPath, 'types', eventSourceConfig.type));
      // @ts-ignore
      const isPureEventSource = !!Object.hasOwnProperty.call(Module.default.prototype, 'initClient');
      let eventSourceInatance: GSEventSource | GSDatasourceAsEventSource;

      if (isPureEventSource) {
        // @ts-ignore
        eventSourceInatance = new Module.default(eventsourcesConfigs[esName]) as GSEventSource; // eslint-disable-line new-cap
        if ('init' in eventSourceInatance) {
          await eventSourceInatance.init();
        }
      } else {
        let correspondingDatasource = datasources[esName]; // By design, datasource and event source need to share the same name.
        if (!correspondingDatasource) {
          throw new Error(`Corresponding datasource for eventsource ${esName} is not defined. Please ensure a datasource type exists with the same file name in /datasources directory`);
        } else {
          // @ts-ignore
          eventSourceInatance = new Module.default(eventsourcesConfigs[esName], correspondingDatasource.client) as GSDatasourceAsEventSource; // eslint-disable-line new-cap
        }
      }

      eventSources[esName] = eventSourceInatance;
    } catch (error) {
      logger.error(error);
    }
  }

  return eventSources;
};