import { path } from './common';
import loadYaml from '../core/yamlLoader';
const testName = path.basename(__filename).split('.')[0];

async function testCode(fixDir:string,testId:string) {
    const { pathString, globalFlag } = require(`${fixDir}/${testId}`);
    const result = await loadYaml(pathString, globalFlag);
    return result;
}

export { testName, testCode };