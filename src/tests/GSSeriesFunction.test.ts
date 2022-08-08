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
    it('seriesSingleFnSuccess', async () => {
        try {
            const testId = 'seriesSingleFnSuccess';
            const result = await require(`${fixDir}/${testId}`).default();
            //const result = await com_gs_http(args);
            logger.debug('result: %o',result);
            expect(result.success).to.equal(true);
            expect(result.code).to.equal(200);
            expect(result.message).to.equal('OK');
            expect(result.data.json).to.have.keys('application_id','code','customer_consent','customer_name','date_of_birth','gender','mobile_number','pan_number','personal_email_id');
            expect(result.data.json.personal_email_id).to.equal('ala.eforwich@email.com');
            expect(result.data.json.gender).to.equal('O');
            expect(result.headers).to.be.an('Object');
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
    it('pathParam', async () => {
        try {
            const testId = 'pathParam';
            const result = await require(`${fixDir}/${testId}`).default();
            logger.debug('result: %o',result);
            expect(result.data.config.method).to.equal("employee.create");
            expect(result.code).to.equal(200);
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
});
