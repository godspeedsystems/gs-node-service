import { describe, it, expect, glob, path, fs, expectObj } from './common';
import loadModules from '../core/codeLoader';
import { fail } from 'assert';

const testName = path.basename(__filename).split('.')[0]
const fixDir:string = path.join(__dirname, 'fixtures', testName)

describe(testName, () => {
    it('should load code in functions', async () => {
        try {
            const result = await loadModules(fixDir + '/functions');
            expect(result['com.gs.http']).to.be.instanceOf(Function)
            expect(result['com.gs.http.getRandomInt']).to.be.instanceOf(Function)
            expect(result.entry).to.be.instanceOf(Function)
            
        } catch(error) {
            fail(<Error>error);
        }
    });
    it('should load code in plugins', async () => {
        try {
            const result = await loadModules(fixDir + '/plugins',true);
            expect(result.randomInt).to.be.instanceOf(Function)
        } catch(error) {
            fail(<Error>error);
        }
    });
});
       
