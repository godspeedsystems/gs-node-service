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
    it('parentWf1Case1', async () => {
        try {
            const testId = 'parentWf1Case1';
            const result = await require(`${fixDir}/${testId}`).default();
            logger.debug('result: %o',result);

            expect(result.success).to.equal(true);
            expect(result.code).to.equal(200);
            expect(result.data[0].message).to.equal('OK');
            expect(result.data[0].data.json).to.eql({"y": 1});
            expect(result.data[1].success).to.equal(true);
            expect(result.data[1].data).to.equal(6);
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
    it('parentWf1Case2', async () => {
        try {
            const testId = 'parentWf1Case2';
            const result = await require(`${fixDir}/${testId}`).default();
            logger.debug('result: %o',result);

            expect(result.success).to.equal(true);
            expect(result.code).to.equal(200);
            expect(result.data[0].message).to.equal('OK');
            expect(result.data[0].data.json).to.eql({"x": 5,"y": 2});
            expect(result.data[1].success).to.equal(true);
            expect(result.data[1].data).to.equal(7);
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
    it('parentWf1CaseDefault', async () => {
        try {
            const testId = 'parentWf1CaseDefault';
            const result = await require(`${fixDir}/${testId}`).default();
            logger.debug('result: %o',result);

            expect(result.success).to.equal(true);
            expect(result.data).to.equal("switch case 3");
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
    it('parentWf2Input1', async () => {
        try {
            const testId = 'parentWf2Input1';
            const result = await require(`${fixDir}/${testId}`).default();
            logger.debug('result: %o',result);

            expect(result.success).to.equal(true);
            expect(result.code).to.equal(200);
            expect(result.data[0].message).to.equal('OK');
            expect(result.data[0].data.json).to.eql({"y": 1});
            expect(result.data[1].success).to.equal(true);
            expect(result.data[1].data).to.eql({"sum": 6});
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
    it('parentWf2Input2', async () => {
        try {
            const testId = 'parentWf2Input2';
            const result = await require(`${fixDir}/${testId}`).default();
            logger.debug('result: %o',result);

            expect(result.success).to.equal(true);
            expect(result.code).to.equal(200);
            expect(result.data[0].data).to.equal(11);
            expect(result.data[1].success).to.equal(true);
            expect(result.data[1].data).to.eql({"sum": 11});
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
});
