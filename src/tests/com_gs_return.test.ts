import { describe, it, expect, glob, path, fs, expectObj } from './common';
import returnFn from '../functions/com/gs/return';
import { fail } from 'assert';
import { logger } from '../core/logger';

/*
 For all the functions which doesn't return JSON output and return some specific
 output, separate *.test.ts file needs to be created for each such test case.
 Mention each test case and its expected result separately.
*/

const testName = path.basename(__filename).split('.')[0]
const fixDir:string = path.join(__dirname, 'fixtures', testName)

describe(testName, () => {
    it('should return single string', async () => {
        try {
            const result = await returnFn('return single arg');
            logger.debug('result: %s',result)
            expect(result).to.be.equal('return single arg');
        } catch(error) {
            logger.error('error: %s',<Error>error)
            fail(<Error>error);
        }
    });
    it('should return array of strings', async () => {
        try {
            const result = await returnFn('return','multiple','arg');
            logger.debug('result: %s',result)
            expect(result).to.eql(['return', 'multiple', 'arg']);
        } catch(error) {
            logger.error('error: %s',<Error>error)
            fail(<Error>error);
        }
    });
    it('should not return any arg', async () => {
        try {
            const result = await returnFn();
            logger.debug('result: %s',result)
            expect(result).to.eql([]);
        } catch(error) {
            logger.error('error: %s',<Error>error)
            fail(<Error>error);
        }
    });
});
       
