import { describe, it, expect, glob, path, fs, expectObj } from './common';
import { fail } from 'assert';
import com_gs_http from '../functions/com/gs/http';

const testName = path.basename(__filename).split('.')[0]
const fixDir = path.join(__dirname, 'fixtures', testName);

describe(testName, () => {
    it('schemaTrue_getSuccess', async () => {
        try {
            const testId = 'schemaTrue_getSuccess'
            const args = await require(`${fixDir}/${testId}`).default();
            const result = await com_gs_http(args);

            expect(result.success).to.equal(true);
            expect(result.code).to.equal(200);
            expect(result.message).to.equal('OK');
            expect(result.data).to.have.keys('args','headers','origin','url');
            expect(result.headers).to.be.an('Object');
        } catch(error) {
        fail(<Error>error);
        }
    });
    it('schemaTrue_getFail', async () => {
        try {
            const testId = 'schemaTrue_getFail'
            const args = await require(`${fixDir}/${testId}`).default();
            /*
            console.log('-- args: ',args)
            console.log('-- args.datasources.client: ',args.datasource.client)
            console.log('-- args.datasources.client.paths: ',args.datasource.client.paths)
            console.log('-- args.config.url: ',args.config.url)
            */
            const result = await com_gs_http(args);
            //console.log('----- result: ',result)

            expect(result.success).to.equal(false);
            expect(result.code).to.equal(undefined);
            expect(result.message).to.equal("Cannot read properties of undefined (reading 'get')");
            expect(result.data).to.have.keys('code','message');
            expect(result.headers).to.equal(undefined);
        } catch(error) {
        fail(<Error>error);
        }
    });
});
