/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { describe, it, expect, path } from './common';
import { fail } from 'assert';
import com_gs_http from '../functions/com/gs/http';
import { logger } from '../core/logger';

/*
 For all the functions which doesn't return JSON output and return some specific
 output, separate *.test.ts file needs to be created for each such test case.
 Mention each test case and its expected result separately.
*/

const testName = path.basename(__filename).split('.')[0];
const fixDir = path.join(__dirname, 'fixtures', testName);

describe(testName, () => {
    it('schemaTrue_getSuccess', async () => {
        try {
            const testId = 'schemaTrue_getSuccess';
            const args = await require(`${fixDir}/${testId}`).default();
            const result = await com_gs_http(args);
            logger.debug('result: %o',result);

            expect(result.success).to.equal(true);
            expect(result.code).to.equal(200);
            expect(result.message).to.equal('OK');
            expect(result.data).to.have.keys('args','headers','origin','url');
            expect(result.headers).to.be.an('Object');
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
    it('schemaTrue_getFail', async () => {
        try {
            const testId = 'schemaTrue_getFail';
            const args = await require(`${fixDir}/${testId}`).default();
            const result = await com_gs_http(args);
            logger.debug('result: %o',result);

            expect(result.success).to.equal(false);
            expect(result.code).to.equal(500);
            expect(result.message).to.equal("Cannot read properties of undefined (reading 'get')");
            expect(result.data).to.have.keys('code','message');
            expect(result.headers).to.equal(undefined);
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
    it('baseURL_postSuccess', async () => {
        try {
            const testId = 'baseURL_postSuccess';
            const args = await require(`${fixDir}/${testId}`).default();
            const result = await com_gs_http(args);
            logger.debug('result: %o',result);

            expect(result.success).to.equal(true);
            expect(result.code).to.equal(200);
            expect(result.message).to.equal('OK');
            expect(result.data.json).to.eql({"TestData":"user1"});
            expect(result.headers).to.be.an('Object');
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });

    //com.gs.http retry testCase
    it('baseURL_getWithRetryConstant', async () => {
        try {
            const testId = 'baseURL_getWithRetryConstant';
            const args = await require(`${fixDir}/${testId}`).default();            
            const result = await com_gs_http(args);
            logger.debug('result: %o',result);

            expect(result.success).to.equal(false);
            expect(result.code).to.equal(503);
            expect(result.message).to.equal('Request failed with status code 503');
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
    it('baseURL_getWithRetryRandom', async () => {
        try {
            const testId = 'baseURL_getWithRetryRandom';
            const args = await require(`${fixDir}/${testId}`).default();            
            const result = await com_gs_http(args);
            logger.debug('result: %o',result);

            expect(result.success).to.equal(false);
            expect(result.code).to.equal(503);
            expect(result.message).to.equal('Request failed with status code 503');
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
    it('baseURL_getWithRetryExponential', async () => {
        try {
            const testId = 'baseURL_getWithRetryExponential';
            const args = await require(`${fixDir}/${testId}`).default();            
            const result = await com_gs_http(args);
            logger.debug('result: %o',result);

            expect(result.success).to.equal(false);
            expect(result.code).to.equal(503);
            expect(result.message).to.equal('Request failed with status code 503');
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
    it('fileUpload', async () => {
        try {
            const testId = 'fileUpload';
            const args = await require(`${fixDir}/${testId}`).default();            
            const result = await com_gs_http(args);
            logger.debug('result: %o',result);

            expect(result.success).to.equal(true);
            expect(result.code).to.equal(200);
            expect(result.data).to.have.keys('args','data','files','form','headers','json','method','origin','url');
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
});
