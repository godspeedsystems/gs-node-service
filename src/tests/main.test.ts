import { describe, it, expect, glob, path, fs, expectObj } from './common';
import { fail } from 'assert';

const filenames = fs.readdirSync(__dirname);
filenames.forEach(file => {
    if (file.endsWith('.js') || file.endsWith('.ts') ) {
        if (!( file.includes('common.js') || file.includes(path.basename(__filename)) || file.endsWith('test.js') || file.endsWith('test.ts') ) ) {
            const fileAbsPath = path.join(__dirname,file)
            const { testName, testCode } = require(`${fileAbsPath}`);
            const fixDir = path.join(__dirname, 'fixtures', testName);

            describe(testName, () => {
                glob(fixDir + '/*.?(js|ts)', function (err:Error|null, res: string[]) {
                    res.map((file:string) => {
                        const testId = path.basename(file).replace(/\.(js|ts)/i, '');
                        it(testId, async () => {
                            try {
                              const result = await testCode(fixDir,testId);
                              expect(result).to.eql(expectObj[testName][testId]);
                            } catch(error) {
                              fail(<Error>error);
                            }
                        });
                    });
                });
            });
        }
    }
});
