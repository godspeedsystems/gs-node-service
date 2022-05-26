import { PlainObject } from './common';
import { logger } from './logger';
import { checkFunctionExists, PROJECT_ROOT_DIRECTORY} from './utils';
import loadYaml from './yamlLoader';
import {loadJsonSchemaForEvents} from './jsonSchemaValidation';

export default async function loadEvents(functions: PlainObject) {
    logger.info('Loading events');
    const events = await loadYaml(PROJECT_ROOT_DIRECTORY + '/events', true);
    logger.debug(events,'events');
    logger.info('Loaded events: %s',Object.keys(events));

    const checkFn = checkFunctionExists(events,functions);
    if (!checkFn.success) {
        logger.error('Error in loading functions for events. Error message: %s. Exiting.', checkFn.message);
        process.exit(1);
    }
    loadJsonSchemaForEvents(events);
    return events;
}
