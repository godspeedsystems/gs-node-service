import { describe, it, expect, glob, path, fs, PlainObject, expectObj } from './common';
import { validateRequestSchema } from '../core/jsonSchemaValidation';
import { fail } from 'assert';

const testName = path.basename(__filename).split('.')[0]
const fixDir = path.join(__dirname, 'fixtures', testName);

describe(testName, () => {
    glob(fixDir + '/*.?(js|ts)', function (err:Error|null, res: string[]) {
        res.map((file:string) => {
            const testId = path.basename(file).replace(/\.(js|ts)/i, '');
            it(testId, async () => {
                try {
                  const { topic, event, eventSpec } = require(`${fixDir}/${testId}`);
                  const result = await validateRequestSchema(topic, event, eventSpec);
                  expect(result).to.eql(expectObj[testName][testId]);
                } catch(error) {
                  fail(<Error>error);
                }
              });
        });
    });
});

