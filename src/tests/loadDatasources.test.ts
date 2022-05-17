import { describe, it, expect, glob, path, fs, expectObj } from './common';
import loadDatasources from '../core/datasourceLoader';
import { fail } from 'assert';

const testName = path.basename(__filename).split('.')[0]
const pathString:string = path.join(__dirname, 'fixtures', testName)

describe(testName, () => {
    it('should load idfc datasource', async () => {
        try {
            const result = await loadDatasources(pathString);
            const datasource = result.idfc;

            expect(datasource).to.have.keys('client','schema')
            expect(datasource.client).to.have.keys('request','getUri','delete','get','head','options','post','put','patch','defaults','interceptors','create')
            expect(datasource.client.defaults.baseURL).to.be.equal('https://partner-uat.idfc.com');
            expect(datasource.client.defaults.headers.common).to.have.keys('Accept','api-key','api-token','Authorization');
            expect(datasource.client.defaults.headers.common?.['api-key']).to.be.equal('239731bc3a784dcda31918891b183f32');
            expect(datasource.client.defaults.headers.common?.['api-token']).to.be.equal('679e36a018524e6dbfd3f184059b29f0');
            expect(datasource.client.defaults.headers.common.Authorization).to.be.equal('Bearer 8797987ad');
            expect(datasource.client.defaults.auth.username).to.be.equal('user');
            expect(datasource.client.defaults.auth.password).to.be.equal('9089899fgt');
        } catch(error) {
            fail(<Error>error);
        }
    });
    it('should load growthsource datasource having config values', async () => {
        try {
            const result = await loadDatasources(pathString);
            const datasource = result.growthsource;

            expect(datasource).to.have.keys('client','schema')
            expect(datasource.client).to.have.keys('request','getUri','delete','get','head','options','post','put','patch','defaults','interceptors','create')
            expect(datasource.client.defaults.baseURL).to.be.equal('http://127.0.0.1:8098/lending/gs/api');
            expect(datasource.client.defaults.headers.common).to.have.keys('Accept','x-api-key','Authorization');
            expect(datasource.client.defaults.headers.common?.['x-api-key']).to.be.equal('plpinelabs');
            expect(datasource.client.defaults.headers.common.Authorization).to.be.equal('basic 2b6a50d0-2090-11ec-a119-a7656cbcab18');
        } catch(error) {
            fail(<Error>error);
        }
    });
});
       
