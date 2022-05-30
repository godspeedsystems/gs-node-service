import { describe, it, expect, glob, path, fs, expectObj } from './common';
import { randomString, randomInt } from '../plugins/index'
import { fail } from 'assert';
import { logger } from '../core/logger';

/*
 For all the functions which doesn't return JSON output and return some specific
 output, separate *.test.ts file needs to be created for each such test case.
 Mention each test case and its expected result separately.
*/
const testName = path.basename(__filename).split('.')[0];
const fixDir: string = path.join(__dirname, 'fixtures', testName);

describe(testName, () => {
   
  
    
    it(' check characters are match to the final result', () => {
        // object that will be queried

        try {
            const result = randomString(10, "abc");
            const finalStr = /[abc]+/.test(result);

            logger.debug('result: %s', result);
            expect(finalStr).to.be.equal(true);
        } catch (error) {
            fail(<Error>error);
        }
    });
    it(' check if characters are not match to the final result', () => {
        // object that will be queried

        try {
            const result = randomString(10, "abc");
            const finalStr = /[def]+/.test(result);

            logger.debug('result: %s', result);
            expect(finalStr).to.be.equal(false);
        } catch (error) {
            fail(<Error>error);
        }
    });
    it(' check if characters is not pass and length of the final result', () => {
        // object that will be queried

        try {
            const result = randomString(10, "abc");

            logger.debug('result: %s', result);
            expect(result.length).to.be.equal(10);
        } catch (error) {
            fail(<Error>error);
        }
    });
    it(' check if length is 0', () => {
        // object that will be queried

        try {
            const result = randomString(0,"abc");

            logger.debug('result: %s', result);
            expect(result).to.be.equal('');
        } catch (error) {
            fail(<Error>error);
        }
    });
 
    it(' Test randomInt for fail case function', () => {
        // object that will be queried

        try {
            const result = randomInt(0, 0);

            logger.debug('result: %s', result);
            expect(result).to.be.equal(0);
        } catch (error) {
            fail(<Error>error);
        }
    });
   
  
});
