import path from 'path';
import { PlainObject } from '../../../core/common';
import { logger } from '../../../core/logger';
import { loadFunctions } from '../../../core/functionLoader';
import loadDatasources from '../../../core/datasourceLoader';

let functions:PlainObject;
const testDir = path.resolve(__dirname + '/testData');
const pathString = path.resolve(testDir + '/events');

//Load inputs for loadEvents function
async function loadInputs() {
    const datasources = await loadDatasources(testDir + '/datasources');
    const loadFnStatus = await loadFunctions(datasources,testDir + '/functions');
    if (loadFnStatus.success) {
        functions = loadFnStatus.functions;
    } else {
        logger.error('Unable to load functions');
    }
    return functions;
}

export { loadInputs, pathString };
