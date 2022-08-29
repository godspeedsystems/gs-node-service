import { PlainObject } from './common';
import { logger } from './logger';
import { checkFunctionExists } from './utils';
import loadYaml from './yamlLoader';
import {loadJsonSchemaForEvents} from './jsonSchemaValidation';
import expandVariables from './expandVariables';

export default async function loadEvents(functions: PlainObject,pathString: string) {
    logger.info('Loading events');
    const events = await loadYaml(pathString, true);
    logger.debug(events,'events');
    logger.info('Loaded events: %s',Object.keys(events));

    const evalEvents = expandVariables(events);

    const checkFn = checkFunctionExists(events,functions);
    if (!checkFn.success) {
        logger.error('Error in loading functions for events. Error message: %s. Exiting.', checkFn.message);
        process.exit(1);
    }
    loadJsonSchemaForEvents(evalEvents);
    return evalEvents;
}
