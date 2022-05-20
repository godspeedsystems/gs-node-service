import { describe, it, expect, glob, path, fs, expectObj } from './common';
import { getAtPath } from '../core/utils';
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
    const object = {
        'name': 'kushal Chauhan',
        'designation': 'Software Enginner',
        'education': {
            'college': {
                'name': 'IIIT',
                'yop': 2021
            }
        }
    }
    // path to retrieve value
    const collegeYopPath = 'education.college.yop'
    // falsy path to retrieve value
    const falsyPath = 'education.college.passingYear'
    it(' return the value at the specified path', () => {
        // object that will be queried

        try {
            const result = getAtPath(object, collegeYopPath);
            logger.debug('result: %s', result)
            expect(result).to.be.equal(2021);
        } catch (error) {
            fail(<Error>error);
        }
    });
    it(' falsy path to retrieve value', () => {
        try {
            const result = getAtPath(object, falsyPath);
            logger.debug('result: %s', result)
            expect(result).to.be.equal(undefined);
        } catch (error) {
            fail(<Error>error);
        }
    });


});

