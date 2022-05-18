import { describe, it, expect, glob, path, fs, expectObj } from './common';
import transformFn from '../functions/com/gs/transform';
import { fail } from 'assert';

const testName = path.basename(__filename).split('.')[0]
const fixDir:string = path.join(__dirname, 'fixtures', testName)

describe(testName, () => {
    it('should transform single string', async () => {
        try {
            const result = await transformFn('transform single arg');
            expect(result).to.be.equal('transform single arg');
        } catch(error) {
            fail(<Error>error);
        }
    });
    it('should transform array of strings', async () => {
        try {
            const result = await transformFn('transform','multiple','arg');
            expect(result).to.eql(['transform', 'multiple', 'arg']);
        } catch(error) {
            fail(<Error>error);
        }
    });
    it('should not transform any arg', async () => {
        try {
            const result = await transformFn();
            expect(result).to.eql([]);
        } catch(error) {
            fail(<Error>error);
        }
    });
});
       
