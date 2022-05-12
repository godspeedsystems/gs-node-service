import { describe, it, expect, glob, path, fs, PlainObject, expectObj } from './common';
import loadYaml from '../core/yamlLoader';
import { fail } from 'assert';
//let expectObj:PlainObject = {};

const testName = path.basename(__filename).split('.')[0]
const fixDir = path.join(__dirname, 'fixtures', testName);

describe(testName, () => {
    glob(fixDir + '/*.?(js|ts)', function (err:Error|null, res: string[]) {
        res.map((file:string) => {
            const testId = path.basename(file).replace(/\.(js|ts)/i, '');
            it(testId, async () => {
                try {
                  const { pathString, globalFlag } = require(`${fixDir}/${testId}`);
                  const result = await loadYaml(pathString, globalFlag);
                  expect(result).to.eql(expectObj[testName][testId]);
                } catch(error) {
                  fail(<Error>error);
                }
            });
        });
    });
});

