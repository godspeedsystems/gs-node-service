import { describe, it, expect, glob, path, fs, expectObj } from './common';
import { getAtPath, setAtPath, checkFunctionExists, checkDatasource, removeNulls } from '../core/utils';
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
    it('checkDatasource - Check added for wrong datasource name', () => {
        try {
            const datasources = {
                "summary": "Create and read data",
                "tasks": [
                  {
                    "id": "step1",
                    "description": "Create entity from REST input data (POST request)",
                    "fn": "com.gs.datastore",
                    "args": {
                      "datasource": "mongo",
                      "config": {
                        "method": "<% inputs.params.entity_type %>.create"
                      }
                    }
                  },
                  {
                    "id": "step2",
                    "description": "test again",
                    "fn": "com.gs.datastore",
                    "args": {
                      "datasource": "mongo",
                      "config": {
                        "method": "<% inputs.params.entity_type %>.findMany"
                      }
                    }
                  }
                ]
              };
              const workflowJson ={
                "summary": "upload documents",
                "id": "upload_documents",
                "tasks": [
                  {
                    "id": "step1",
                    "description": "upload documents",
                    "fn": "com.gs.http",
                    "args": {
                      "datasource": "growth_source_wrapper",
                      "params": null,
                      "data": "<js% { \n  [inputs.body.entity_type + 'id']: inputs.body.entity_id, \n  _.omit(inputs.body, ['entity_type', 'entity_id'])} \n%>\n",
                      "file_key": "files",
                      "files": "<% inputs.files %>",
                      "config": {
                        "url": "/v1/documents",
                        "method": "post"
                      }
                    },
                    "retry": {
                      "maxAttempt": 5,
                      "type": "constant",
                      "interval": "PT15M"
                    },
                    "on_error": {
                      "continue": false,
                      "response": "<%'Some error happened in saving' + inputs.body.entity_type%>"
                    }
                  }
                ]
              };
              
            const result = checkDatasource(workflowJson, datasources);
            logger.debug('result: %o', result);
            expect(result.success).to.be.equal(false);

        } catch (error) {
            fail(<Error>error);
        }
    });
    it('removeNulls - Check added for wrong datasource name', () => {
        try {     
            const obj = {
                one: null,
                two: 2,
                three: null,
              };
            const result = removeNulls(obj);
            logger.debug('result: %o', result);
            expect(JSON.stringify(result)).to.be.equal(JSON.stringify({ two: 2}));

        } catch (error) {
            fail(<Error>error);
        }
    });
    
});
