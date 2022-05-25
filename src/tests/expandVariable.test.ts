import { describe, it, expect, glob, path, fs, expectObj } from './common';
import expandVariable from '../core/expandVariables';
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

            logger.debug('result: %s', result)
            expect(result).to.be.equal("1.0");
        } catch (error) {
            fail(<Error>error);
        }
    });
    it('If specified path is wrong ', () => {
        // object that will be modified

        try {
            const result = expandVariable("<%config.api%>");

            logger.debug('result: %s', result)
            expect(result).to.be.equal(undefined);
        } catch (error) {
            fail(<Error>error);
        }
    });
    it('Cannot read value', () => {
        // object that will be modified

        try {
            const result = expandVariable("config.log_level");
            console.log("config.log_level:", result)

            logger.debug('result: %s', result)

            expect(result).to.be.equal("config.log_level");
        } catch (error) {
            fail(<Error>error);
        }
    });

});

