import { PlainObject } from './common';
import { logger } from './logger';
import { checkFunctionExists, PROJECT_ROOT_DIRECTORY} from './utils';
import loadYaml from './yamlLoader';
import {loadJsonSchemaForEvents} from './jsonSchemaValidation';
import { ConfigSource } from 'kafkajs';

export default async function loadEvents(functions: PlainObject,pathString: string) {
    logger.info('Loading events');
    const events = await loadYaml(pathString, true);
    logger.debug(events,'events');
    logger.info('Loaded events: %s',Object.keys(events));

    const checkFn = checkFunctionExists(events,functions);
    console.log('checkFn: ',checkFn);
    if (!checkFn.success) {
        logger.error('Error in loading functions for events. Error message: %s. Exiting.', checkFn.message);
        process.exit(1);
    }
    console.log('going to load json schema');
    loadJsonSchemaForEvents(events);
    return events;
}