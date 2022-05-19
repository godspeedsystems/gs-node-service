import { describe, it, expect, path } from './common';
import loadModules from '../core/codeLoader';
import { fail } from 'assert';
import { logger } from '../core/logger';

/*
 For all the functions which doesn't return JSON output and return some specific
 output, separate *.test.ts file needs to be created for each such test case.
 Mention each test case and its expected result separately.
 This is test case file for loadModules function. 
*/
const testName = path.basename(__filename).split('.')[0]
const fixDir:string = path.join(__dirname, 'fixtures', testName)

describe(testName, () => {
    it('should load code in functions', async () => {
        try {
            logger.debug('fixDir: %s',fixDir)
            const result = await loadModules(fixDir + '/functions');
            logger.debug('keys of result: %s',Object.keys(result))
            expect(result['com.gs.http']).to.be.instanceOf(Function)
            expect(result['com.gs.http.getRandomInt']).to.be.instanceOf(Function)
            expect(result.entry).to.be.instanceOf(Function)
            
        } catch(error) {
            logger.error('error: %o',error)
            fail(<Error>error);
        }
    });
    it('should load code in plugins', async () => {
        try {
            logger.debug('fixDir: %s',fixDir)
            const result = await loadModules(fixDir + '/plugins',true);
            logger.debug('keys of result: %s',Object.keys(result))
            expect(result.randomInt).to.be.instanceOf(Function)
        } catch(error) {
            logger.error('error: %o',error)
            fail(<Error>error);
        }
    });
});       
