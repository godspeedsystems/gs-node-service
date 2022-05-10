import { describe, it, expect, glob, path, fs, PlainObject } from '../../../common';
import loadYaml from '../../../../../core/yamlLoader';
import { fail } from 'assert';
let expectObj:PlainObject = {};

describe('loadYaml', () => {

    glob(__dirname + '/../*.?(js|ts)', function (err:Error|null, res: string[]) {
        res.map((file:string) => {
            const basePath = path.basename(file);
            const testId = basePath.replace(/\.(js|ts)/i, '');

            before(function() {
                try {
                    const expectedPath = __dirname + '/expect/' + testId + '.output';
                    expectObj[testId] = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
                } catch(error) {
                    console.log('before caught error: ',error)
                }
            });            

            it(testId, async () => {
                try {
                  const { pathString, globalFlag } = require(`../${testId}`);
                  const result = await loadYaml(pathString, globalFlag);
                  expect(result).to.eql(expectObj[testId]);
                } catch(error) {
                  fail(<Error>error);
                }
              });
        });
    });
});

