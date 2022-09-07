/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { describe, it, expect, path } from './common';
import { fail } from 'assert';
import com_gs_datastore from '../functions/com/gs/datastore';
import { logger } from '../core/logger';

/*
 For all the functions which doesn't return JSON output and return some specific
 output, separate *.test.ts file needs to be created for each such test case.
 Mention each test case and its expected result separately.
*/

const testName = path.basename(__filename).split('.')[0];
const fixDir = path.join(__dirname, 'fixtures', testName);

describe(testName, () => {
    it('mongoUserFindMany', async () => {
        try {
            const testId = 'mongoUserFindMany';
            const args = await require(`${fixDir}/${testId}`).default();
            const result = await com_gs_datastore(args);
            logger.debug('result: %o',result);

            expect(result.success).to.equal(true);
            expect(result.code).to.equal(200);
            expect(result.data[0].age).to.equal(205);
            expect(result.data[0].name).to.equal("Ada Lovelace");
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
});
