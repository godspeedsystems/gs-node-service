import { describe, it, expect, glob, path, fs, expectObj } from './common';
import { expandVariable } from '../core/utils';
import { fail } from 'assert';
import { logger } from '../core/logger';

/*
 For all the functions which doesn't return JSON output and return some specific
 output, separate *.test.ts file needs to be created for each such test case.
 Mention each test case and its expected result separately.
*/

const testName = path.basename(__filename).split('.')[0]
const fixDir: string = path.join(__dirname, 'fixtures', testName)

describe(testName, () => {
    it(' sets the given value at the specified path and returns the modified object', () => {
        // object that will be modified

        try {
            const result = expandVariable("<%config.api_version%>");
            console.log("result: --++--++--", result)

            logger.debug('result: %s', result)
            expect(result).to.be.equal("1.0");
        } catch (error) {
            fail(<Error>error);
        }
    });


});

