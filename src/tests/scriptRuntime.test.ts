import { describe, it, expect, path } from './common';
import { fail } from 'assert';
import { logger } from '../core/logger';
import evaluateScript from '../scriptRuntime';



/*
 For all the functions which doesn't return JSON output and return some specific
 output, separate *.test.ts file needs to be created for each such test case.
 Mention each test case and its expected result separately.
*/

const testName = path.basename(__filename).split('.')[0];
const fixDir = path.join(__dirname, 'fixtures', testName);

describe(testName, () => {
    it('scriptRuntime', async () => {
        try {
        

   
            
            const testId = 'scriptRuntime';
           const { ctx, script1 } = await require(`${fixDir}/${testId}`);

           console.log("scriptRuntime: ctx", ctx);
            logger.debug('scriptRuntime:script: %s',script1);
           // console.log("scriptRuntime: script", script);

           const result = await evaluateScript(ctx,script1 );


            logger.debug('result: %o',result);
            console.log('result:',result);

             expect(result.data).to.equal("Others");
             expect(result.code).to.equal(200);
            // expect(result).to.equal('OK');

        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
  
});
