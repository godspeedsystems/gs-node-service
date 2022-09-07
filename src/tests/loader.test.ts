/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { describe, it, expect, path } from './common';
import { fail } from 'assert';
import  {config} from '../core/loader';
import { logger } from '../core/logger';

const testName = path.basename(__filename).split('.')[0];
const fixDir = path.join(__dirname, 'fixtures', testName);

describe(testName, () => {
    it('Checking if a tests key exists in a config.app', async () => {
        try {
           // const result = await config(eventPath); 
            const result = await config.app;
            logger.debug('result: %o',result);
            expect(result.hasOwnProperty('tests')).to.equal(true);          
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
    it('Checking if a tests key exists in a config.app', async () => {
        try {
           // const result = await config(eventPath); 
            const result = await config.app;
            logger.debug('result: %o',result);
            expect(Object.keys(result.tests).length === 0).to.equal(false);          
        } catch(error) {
            logger.error('error: %s',<Error>error);
            fail(<Error>error);
        }
    });
 
 
});
