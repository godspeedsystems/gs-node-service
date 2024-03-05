import path from "path";
import { childLogger, logger } from "../logger";
import { PlainObject } from "../types";
import loadYaml from "./yamlLoader";
import { EventSources, GSDataSourceAsEventSource, GSEventSource } from "./_interfaces/sources";
import expandVariables from "./expandVariables"; // Import the expandVariables function

export default async function (eventsourcesFolderPath: string, datasources: PlainObject): Promise<{ [key: string]: GSEventSource | GSDataSourceAsEventSource }> {
  const eventsourcesConfigs = await loadYaml(eventsourcesFolderPath, false);
  if (eventsourcesConfigs && !Object.keys(eventsourcesConfigs).length) {
    logger.fatal(`There are no event sources defined in eventsource dir: ${eventsourcesFolderPath}`);
    process.exit(1);
  }

  const eventSources: EventSources = {};

  for await (let esName of Object.keys(eventsourcesConfigs)) {
    // let's load the event source
    const eventSourceConfig = eventsourcesConfigs[esName];
    logger.debug('evaluating event source %s', esName);
    const location = { eventsource_name: esName };
    eventsourcesConfigs[esName] = expandVariables(eventsourcesConfigs[esName], location);
    logger.debug(
      'evaluated eventsource %s %o',
      esName,
      eventsourcesConfigs[esName]
    );

    const fileName = eventsourcesConfigs[esName].type;
    try {
      const Module = await import(path.join(eventsourcesFolderPath, 'types', fileName));
      const isPureEventSource = 'initClient' in Module.default.prototype;
      // const isPureEventSource = !!Object.hasOwnProperty.call(Module.default.prototype, 'initClient');
      let eventSourceInstance: GSEventSource | GSDataSourceAsEventSource;

      let Constructor = Module.default;

      if (isPureEventSource) {
        eventSourceInstance = new Constructor(eventsourcesConfigs[esName], datasources) as GSEventSource;
        if ('init' in eventSourceInstance) {
          await eventSourceInstance.init();
        }
      } else {
        let correspondingDatasource = datasources[esName]; // By design, datasource and event source need to share the same name.
        if (!correspondingDatasource) {
          childLogger.fatal(`Corresponding data source for event source ${esName} is not defined. Please ensure a data source type exists with the same file name in src/datasources directory`);
          process.exit(1);
        } else {
          eventSourceInstance = new Constructor(eventsourcesConfigs[esName], correspondingDatasource.client) as GSDataSourceAsEventSource;
        }
      }

      eventSources[esName] = eventSourceInstance;
    } catch (error: any) {
      logger.error('Failed to load event source %s %s %o', esName, error.message, error);
      process.exit(1);
    }
  }

  return eventSources;
};