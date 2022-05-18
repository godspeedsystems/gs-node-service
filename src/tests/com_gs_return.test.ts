import { describe, it, expect, glob, path, fs, expectObj } from './common';
import returnFn from '../functions/com/gs/return';
import { fail } from 'assert';

const testName = path.basename(__filename).split('.')[0]
const fixDir:string = path.join(__dirname, 'fixtures', testName)

describe(testName, () => {
    it('should return single string', async () => {
        try {
            const result = await returnFn('return single arg');
            expect(result).to.be.equal('return single arg');
        } catch(error) {
            fail(<Error>error);
        }
    });
    it('should return array of strings', async () => {
        try {
            const result = await returnFn('return','multiple','arg');
            expect(result).to.eql(['return', 'multiple', 'arg']);
        } catch(error) {
            fail(<Error>error);
        }
    });
    it('should not return any arg', async () => {
        try {
            const result = await returnFn();
            expect(result).to.eql([]);
        } catch(error) {
            fail(<Error>error);
        }
    });
});
       
