import { describe, it, expect, path } from './common';
import { fail } from 'assert';
import { logger } from '../core/logger';

/*
 For all the functions which doesn't return JSON output and return some specific
 output, separate *.test.ts file needs to be created for each such test case.
 Mention each test case and its expected result separately.
*/

const testName = path.basename(__filename).split('.')[0];
const fixDir = path.join(__dirname, 'fixtures', testName);

describe(testName, () => {
    it('onErrorTest', async () => {
        try {
            const testId = 'onErrorTest';
            const result = await require(`${fixDir}/${testId}`).default();
            logger.debug('result: %o',result);
            expect(result.success).to.equal(true);
            expect(result.code).to.equal(200);
            expect(result.data.message).to.equal('OK');

        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
    it('onErrorWithRes', async () => {
        try {
            const testId = 'onErrorWithRes';
            const result = await require(`${fixDir}/${testId}`).default();
            console.log("onErrorWithRes:result:", result);
            logger.debug('result: %o',result);
            expect(result.success).to.equal(true);
            expect(result.code).to.equal(200);
            expect(result.data.data.url).to.equal('https://httpbin.org/anything');
           

        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
    it('onErrorWithoutRes', async () => {
        try {
            const testId = 'onErrorWithoutRes';
            const result = await require(`${fixDir}/${testId}`).default();
            logger.debug('result: %o',result);
            expect(result.success).to.equal(true);
            expect(result.code).to.equal(200);
            expect(result.data.data.url).to.equal("https://httpbin.org/anything");

        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
});
