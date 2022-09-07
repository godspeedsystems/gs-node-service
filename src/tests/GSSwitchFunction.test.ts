/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
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
    it('switchBasicCase1', async () => {
        try {
            const testId = 'switchBasicCase1';
            const result = await require(`${fixDir}/${testId}`).default();
            logger.debug('result: %o',result);

            expect(result.success).to.equal(true);
            expect(result.data).to.equal('switch case 1');
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
    it('switchBasicCase2', async () => {
        try {
            const testId = 'switchBasicCase2';
            const result = await require(`${fixDir}/${testId}`).default();
            logger.debug('result: %o',result);

            expect(result.success).to.equal(true);
            expect(result.data).to.equal(8);
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
    it('switchBasicCaseDefault', async () => {
        try {
            const testId = 'switchBasicCaseDefault';
            const result = await require(`${fixDir}/${testId}`).default();
            logger.debug('result: %o',result);

            expect(result.success).to.equal(false);
            expect(result.message).to.equal('socket hang up');
            expect(result.data.code).to.equal('Error');
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
});
