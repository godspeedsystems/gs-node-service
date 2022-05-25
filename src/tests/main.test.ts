import { describe, it, expect, glob, path, fs, expectObj } from './common';
import { fail } from 'assert';
import { logger } from '../core/logger';

/* 
 This is the main test case file which does:
 Read *.ts files except (*test.ts files, common.ts, current file) in current directory to execute test cases for those files.
 Here, it is assumed that these files will be returning JSON output. And all the input/output for each test case
 is provided in fixtures/ directory so that each JSON kind of output test case can be executed and compared with the expected output.
*/

logger.info('Starting execution of main.test');
const filenames = fs.readdirSync(__dirname);
filenames.forEach(file => {
    if (file.endsWith('.js') || file.endsWith('.ts') ) {
        if (!( file.includes('common.js') || file.includes(path.basename(__filename)) || file.endsWith('test.js') || file.endsWith('test.ts') ) ) {
            const fileAbsPath = path.join(__dirname,file);
            const { testName, testCode } = require(`${fileAbsPath}`);
            const fixDir = path.join(__dirname, 'fixtures', testName);

            logger.info('Reading test case file %s',file);
            describe(testName, () => {
                glob(fixDir + '/*.?(js|ts)', function (err:Error|null, res: string[]) {
                    logger.debug('Reading fixtures from %s',fixDir);
                    res.map((file:string) => {
                        const testId = path.basename(file).replace(/\.(js|ts)/i, '');
                        it(testId, async () => {
                            try {
                                logger.debug('executing %s',testId);
                                const result = await testCode(fixDir,testId);
                                logger.debug('result: %o',result);
                                expect(result).to.eql(expectObj[testName][testId]);
                            } catch(error) {
                                logger.error('erro: %o',error);
                                fail(<Error>error);
                            }
                        });
                    });
                });
            });
        }
    }
});
