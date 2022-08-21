import { describe, it, expect, path } from './common';
import { fail } from 'assert';
import com_gs_kafka from '../functions/com/gs/kafka';
import { logger } from '../core/logger';

/*
 For all the functions which doesn't return JSON output and return some specific
 output, separate *.test.ts file needs to be created for each such test case.
 Mention each test case and its expected result separately.
*/

const testName = path.basename(__filename).split('.')[0];
const fixDir = path.join(__dirname, 'fixtures', testName);

describe(testName, () => {
    it('createTopic', async () => {
        try {
            const testId = 'createTopic';
            const args = await require(`${fixDir}/${testId}`).default();
            const result = await com_gs_kafka(args);
            logger.debug('result: %o',result);
            const topicName:any[] = [];
            result.forEach((elem:any)=>{topicName.push(elem.topicName);});
            expect(topicName[0]).to.equal('myTopic');
 
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
   
});
