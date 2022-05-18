import { path } from './common';
import { validateResponseSchema } from '../core/jsonSchemaValidation';

const testName = path.basename(__filename).split('.')[0]

async function testCode(fixDir:string,testId:string) {
    const { topic, status } = require(`${fixDir}/${testId}`);

    const result = await validateResponseSchema(topic, status);
    return result
}
export { testName, testCode }
