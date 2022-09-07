/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
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
           console.log("scriptRuntime:ctx:", ctx);
            logger.debug('script1: %s',script1);
            const result = await evaluateScript(ctx,script1 );
            logger.debug('result: %o',result);
             expect(result.data).to.equal("Others");
             expect(result.code).to.equal(200);
            // expect(result).to.equal('OK');
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
    it('scriptRuntimeCondition', async () => {
        try {
           const testId = 'scriptRuntimeCondition';
           const { ctx, script1 } = await require(`${fixDir}/${testId}`);

            const result = await evaluateScript(ctx,script1 );
            console.log("scriptRuntimeCondition: result", result);
             expect(result.data).to.equal('Others');
             expect(result.code).to.equal(200);
             expect(result.headers.Host).to.equal("httpbin.org");

        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });

    it('scriptRuntimeConditionFail', async () => {
        try {
           const testId = 'scriptRuntimeConditionFail';
           const { ctx, script1 } = await require(`${fixDir}/${testId}`);

            const result = await evaluateScript(ctx,script1 );
            logger.debug("scriptRuntimeConditionFail:script1: %s", script1);

             expect(result.code).to.equal(500);
             expect(result.success).to.equal(false);

        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });

    it('multipleVariablesInSingleLine', async () => {
        try {
           const testId = 'multipleVariablesInSingleLine';
           const { ctx, script1 } = await require(`${fixDir}/${testId}`);
            const result = await evaluateScript(ctx,script1 );
            logger.debug("multipleVariablesInSingleLine:script1: %s", script1);
            expect(result).to.equal("http://x.com/1234/application?p=Male");
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
    it('mappings', async () => {
        try {
           const testId = 'mappings';
           const { ctx, script1 } = await require(`${fixDir}/${testId}`);
            const result = await evaluateScript(ctx,script1 );
             expect(result).to.equal("M");

        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });

    it('singleLine', async () => {
        try {
           const testId = 'singleLine';
           const { ctx, script1, script2 } = await require(`${fixDir}/${testId}`);
            const result1 = await evaluateScript(ctx,script1 );
            const result2 = await evaluateScript(ctx,script2 );

             expect(result1).to.equal("Hello Kushal Chauhan");
             expect(result2).to.equal("Male");


        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
    it('multipleVariablesInMultiLine', async () => {
        try {
           const testId = 'multipleVariablesInMultiLine';
           const { ctx, script1 } = await require(`${fixDir}/${testId}`);
            const result = await evaluateScript(ctx,script1 );
           expect(result.name).to.equal("Kushal");
           expect(result.Gender).to.equal("Male");


        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
  
    it('pathAndQuery', async () => {
        try {
           const testId = 'pathAndQuery';
           const { ctx, script1, script2 } = await require(`${fixDir}/${testId}`);
            const result1 = await evaluateScript(ctx,script1 );
            const result2 = await evaluateScript(ctx,script2 );


       expect(result1).to.equal('bank_id: ABC');
         expect(result2).to.equal("lender_loan_application_id: 1234");


        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
});
