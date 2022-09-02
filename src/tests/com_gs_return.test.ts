import { describe, it, expect, glob, path, fs, expectObj } from './common';
import returnFn from '../functions/com/gs/return';
import { fail } from 'assert';
import { logger } from '../core/logger';

/*
 For all the functions which doesn't return JSON output and return some specific
 output, separate *.test.ts file needs to be created for each such test case.
 Mention each test case and its expected result separately.
*/

const testName = path.basename(__filename).split('.')[0];
const fixDir:string = path.join(__dirname, 'fixtures', testName);

describe(testName, () => {
    it('should return single string', async () => {
        try {
            const result = await returnFn('return single arg');
            logger.debug('result: %o',result);
            expect(result).to.be.an('Object');
            expect(result.success).to.equal(true);
            expect(result.code).to.equal(200);
            expect(result.exitWithStatus).to.be.equal(true);
            expect(result.data).to.equal("return single arg");

        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
    it('should return array of strings', async () => {
        try {
            const result = await returnFn('return','multiple','arg');
            logger.debug('result: %o',result);
            expect(result).to.be.an('Object');
            expect(result.success).to.equal(true);
            expect(result.code).to.equal(200);
            expect(result.exitWithStatus).to.be.equal(true);
            expect(result.data).to.eql(['return', 'multiple']);
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
    it('should not return any arg', async () => {
        try {
            const result = await returnFn();
            logger.debug('result: %o',result);
            expect(result).to.be.an('Object');
            expect(result.success).to.equal(true);
            expect(result.code).to.equal(200);
            expect(result.exitWithStatus).to.be.equal(true);
            expect(result.data).to.be.equal(undefined);
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
});
       
