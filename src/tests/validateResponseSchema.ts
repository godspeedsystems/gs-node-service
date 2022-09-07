/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { path } from './common';
import { validateResponseSchema } from '../core/jsonSchemaValidation';

const testName = path.basename(__filename).split('.')[0];

async function testCode(fixDir:string,testId:string) {
    const { topic, status } = require(`${fixDir}/${testId}`);

    const result = await validateResponseSchema(topic, status);
    return result;
}
export { testName, testCode };
