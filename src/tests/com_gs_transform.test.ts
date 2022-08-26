import { describe, it, expect, glob, path, fs, expectObj } from './common';
import transformFn from '../functions/com/gs/transform';
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
    it('should transform single string', async () => {
        try {
            const result = await transformFn('transform single arg');
            logger.debug('result: %s',result);
            expect(result).to.be.equal('transform single arg');
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
    it('should transform array of strings', async () => {
        try {
            const result = await transformFn('transform','multiple','arg');
            logger.debug('result: %s',result);
            expect(result).to.eql(['transform', 'multiple']);
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
    it('should not transform any arg', async () => {
        try {
            const result = await transformFn();
            logger.debug('result: %s',result);
            expect(result).to.be.equal(undefined);
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
});
       
