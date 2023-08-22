/**
 * > things for displosal, config, mappings, datasources
 * > eventsource loader
 *    assumptions:
 *      1. eveny eventsource is a datasource first,
 *
 * /project
 *  /datasources
 *   /types
 *     kafka.ts = initFn, executeFn
 *   kakfa1.yaml
 *  /evntsources
 *    /types
 *      kafka.ts = subscribeFn
 *    kafka1.yaml
 *
 *
 * steps:
 *  1. scan /eventsources for eventsource yaml and based on type, find the `subscribeFn`
 *  2. if types/[type of eventsource] of datasources/[type.ts]
 *    NO
 *      - Notify the user, break the initilization flow
 *    YES
 *      - using the datasource client, execute `subscribeFn` for these kind of events
 *      - execute all the subecribeFn for corresponding events
 */

import path from "path";
import { logger } from "../logger";
import { PlainObject } from "../types";
import loadYaml from "./yamlLoader";
import config from "config";

export default async function (eventsourcesFolderPath: string, datasources: PlainObject): Promise<{ [key: string]: EventSource }> {
  logger.info('eventsourcesFolderPath %s', eventsourcesFolderPath);
  logger.info('datasources %o', datasources);

  const eventsourcesConfigs = await loadYaml(eventsourcesFolderPath, false);
  const eventSources: { [key: string]: EventSource } = {};

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

          const eventSourceInstance: EventSource = new Module.default(config, correspondingDatasource); // eslint-disable-line

          logger.debug('module info %o', Object.keys(Module));

          eventSources[esName] = eventSourceInstance;
        });
    }
  }

  return eventSources;
};