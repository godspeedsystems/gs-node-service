import { path } from './common';
import iterate_yaml_directories from '../core/configLoader';
const testName = path.basename(__filename).split('.')[0];

async function testCode(fixDir:string,testId:string) {
    const { pathString } = require(`${fixDir}/${testId}`);
    const result = await iterate_yaml_directories(pathString);
    return result;
}

export { testName, testCode };