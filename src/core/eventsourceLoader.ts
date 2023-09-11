import path from "path";
import { logger } from "../logger";
import { PlainObject } from "../types";
import loadYaml from "./yamlLoader";
import { GSDataSourceAsEventSource, GSEventSource } from "./_interfaces/sources";

export default async function (eventsourcesFolderPath: string, datasources: PlainObject): Promise<{ [key: string]: GSEventSource | GSDataSourceAsEventSource }> {
  const eventsourcesConfigs = await loadYaml(eventsourcesFolderPath, false);
  if (eventsourcesConfigs && !Object.keys(eventsourcesConfigs).length) {
    throw new Error(`There are no eventsources defined in eventsource dir: ${eventsourcesFolderPath}`);
  }

  const eventSources: { [key: string]: GSEventSource | GSDataSourceAsEventSource } = {};

  for await (let esName of Object.keys(eventsourcesConfigs)) {
    // let's load the event source
    const eventSourceConfig = eventsourcesConfigs[esName];
    try {
      const Module = await import(path.join(eventsourcesFolderPath, 'types', eventSourceConfig.type));
      const isPureEventSource = !!Object.hasOwnProperty.call(Module.default.prototype, 'initClient');
      let eventSourceInatance: GSEventSource | GSDataSourceAsEventSource;

      let Constructor = Module.default;

      if (isPureEventSource) {
        eventSourceInatance = new Constructor(eventsourcesConfigs[esName]) as GSEventSource;
        if ('init' in eventSourceInatance) {
          await eventSourceInatance.init();
        }
      } else {
        let correspondingDatasource = datasources[esName]; // By design, datasource and event source need to share the same name.
        if (!correspondingDatasource) {
          throw new Error(`Corresponding datasource for eventsource ${esName} is not defined. Please ensure a datasource type exists with the same file name in /datasources directory`);
        } else {
          eventSourceInatance = new Constructor(eventsourcesConfigs[esName], correspondingDatasource.client) as GSDataSourceAsEventSource;
        }
      }

      eventSources[esName] = eventSourceInatance;
    } catch (error) {
      logger.error(error);
    }
  }

  return eventSources;
};