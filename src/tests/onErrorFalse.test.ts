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
    it('onErrorTest', async () => {
        try {
            const testId = 'onErrorTest';
            const result = await require(`${fixDir}/${testId}`).default();
            logger.debug('result: %o',result);
            expect(result.success).to.equal(true);
            expect(result.code).to.equal(200);
            expect(result.data.message).to.equal('getaddrinfo ENOTFOUND httpbinabc.org');
            expect(result.data.data).to.equal('Some error happened');


        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
    it('onErrorTestFalse', async () => {
        try {
            const testId = 'onErrorTestFalse';
            const result = await require(`${fixDir}/${testId}`).default();
            logger.debug('result: %o',result);
            expect(result.success).to.equal(true);
            expect(result.code).to.equal(200);
            expect(result.data.message).to.equal('getaddrinfo ENOTFOUND httpbinabc.org');
            expect(result.data.data.data).to.equal('Some error happened');
            expect(result.data.data.code).to.equal(200);



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
            expect(result.data.data.message).to.equal('getaddrinfo ENOTFOUND httpbinabc.org');
            expect(result.data.data.code).to.equal('Error');



        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
});
