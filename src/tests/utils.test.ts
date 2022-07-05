import { describe, it, expect, glob, path, fs, expectObj } from './common';
import { getAtPath, setAtPath, checkFunctionExists } from '../core/utils';
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
    it('getAtPath - return the value at the specified path', () => {
        // object that will be queried
        try {
            const object = {
                'name': 'kushal Chauhan',
                'designation': 'Software Enginner',
                'education': {
                    'college': {
                        'name': 'IIIT',
                        'yop': 2021
                    }
                }
            };
            // path to retrieve value
            const collegeYopPath = 'education.college.yop';
            const result = getAtPath(object, collegeYopPath);
            logger.debug('result: %s', result);
            expect(result).to.be.equal(2021);
        } catch (error) {
            fail(<Error>error);
        }
    });
    it('getAtPath - falsy path to retrieve value', () => {
        try {
            const object = {
                'name': 'kushal Chauhan',
                'designation': 'Software Enginner',
                'education': {
                    'college': {
                        'name': 'IIIT',
                        'yop': 2021
                    }
                }
            };
            // falsy path to retrieve value
            const falsyPath = 'education.college.passingYear';
            const result = getAtPath(object, falsyPath);
            logger.debug('result: %s', result);
            expect(result).to.be.equal(undefined);
        } catch (error) {
            fail(<Error>error);
        }
    });
    it('setAtPath - sets the given value at the specified path and returns the modified object', () => {
        // object that will be modified
        const object = {
            'name': 'Kushal Chauhan',
            'designation': 'Software Enginner',
            'education': {
            }
        };

        // value to set
        const collegeEducation = {
            'name': 'IIIT',
            'yop': 2021
        };

        // path of the value to be set
        const path = 'education.college';
        try {
            setAtPath(object, path, collegeEducation);
            logger.debug('result: %o',object);
            expect(object).to.be.eql({
                "name": "Kushal Chauhan",
                "designation": "Software Enginner",
                "education": {
                    "college": {
                        "name": "IIIT",
                        "yop": 2021
                    }
                }
            });
        } catch (error) {
            fail(<Error>error);
        }
    });
    it('checkFunctionExists - return successs, all events fn are present in functions', () => {
        try {
            const events = {
                "/do_kyc/idfc.http.post": {
                  "fn": "com.biz.create_hdfc_account"
                },
                "/sum.http.get": {
                  "fn": "com.biz.sum-workflow"
                },
                "/test.http.get": {
                  "fn": "com.biz.test"
                }
              };
            const functions = {
                "com.biz.create_hdfc_account": "GSFunction",
                "com.biz.sum-workflow": "GSFunction",
                "com.biz.test": "GSFunction"
              };
            const result = checkFunctionExists(events, functions);
            logger.debug('result: %o', result);
            expect(result.success).to.be.equal(true);
        } catch (error) {
            fail(<Error>error);
        }
    });
    it('checkFunctionExists - return false, events fn is not present in functions', () => {
        try {
            const events = {
                "/do_kyc/idfc.http.post": {
                  "fn": "com.biz.create_hdfc_account"
                },
                "/sum.http.get": {
                  "fn": "com.biz.sum-workflow"
                },
                "/test.http.get": {
                  "fn": "com.biz.test"
                }
              };
            const functions = {
                "com.biz.create_hdfc_account": "GSFunction",
                "com.biz.test": "GSFunction"
              };
            const result = checkFunctionExists(events, functions);
            logger.debug('result: %o', result);
            expect(result.success).to.be.equal(false);
            expect(result.code).to.be.equal(500);
            expect(result.message).to.be.equal('function com.biz.sum-workflow of event /sum.http.get is not present in functions');
        } catch (error) {
            fail(<Error>error);
        }
    });
});
