import { describe, it, expect, glob, path, fs, PlainObject } from './common';
import loadYaml from '../core/yamlLoader';
import { fail } from 'assert';
let expectObj:PlainObject = {};

describe('loadYaml', () => {
    const fixDir = __dirname + '/fixtures/' + path.basename(__filename).split('.')[0] + '/';
    glob( fixDir + '/*.?(js|ts)', function (err:Error|null, res: string[]) {
        res.map((file:string) => {
            const testId = path.basename(file).replace(/\.(js|ts)/i, '');

            before(function() {
                try {
                    const expectedPath = fixDir + '/' + testId + '.output';
                    expectObj[testId] = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
                } catch(error) {
                    console.log('before caught error: ',error)
                }
            });            

            it(testId, async () => {
                try {
                  const { pathString, globalFlag } = require(`${fixDir}/${testId}`);
                  console.log('pathString: ',pathString)
                  const result = await loadYaml(pathString, globalFlag);
                  expect(result).to.eql(expectObj[testId]);
                } catch(error) {
                  fail(<Error>error);
                }
            });
        });
    });
});

