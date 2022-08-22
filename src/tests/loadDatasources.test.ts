import { describe, it, expect, glob, path, fs, expectObj } from './common';
import loadDatasources from '../core/datasourceLoader';
import { fail } from 'assert';
import { logger } from '../core/logger';
import config from 'config';

/*
 For all the functions which doesn't return JSON output and return some specific
 output, separate *.test.ts file needs to be created for each such test case.
 Mention each test case and its expected result separately.
*/

const testName = path.basename(__filename).split('.')[0];
const pathString:string = path.join(__dirname, 'fixtures', testName);

describe(testName, () => {
    it('should load idfc datasource', async () => {
        try {
            logger.debug('pathString: %s',pathString);
            const datasources = await loadDatasources(pathString);
            const datasource = datasources.idfc(config, {}, {}, {});
            logger.debug('result idfc: %o',datasource);

            expect(datasource).to.have.keys('client','schema','base_url','type','securitySchemes','security');
            expect(datasource.client).to.have.keys('request','getUri','delete','get','head','options','post','put','patch','defaults','interceptors','create');
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
            logger.debug('pathString: %s',pathString);
            const datasources = await loadDatasources(pathString);
            const datasource = datasources.growthsource({}, {}, {}, {});
            logger.debug('result: %o',datasource);

            expect(datasource).to.have.keys('client','schema','base_url','type','securitySchemes','security');
            expect(datasource.type).to.be.equal('api');
            expect(datasource.schema).to.be.equal(true);
            expect(datasource.base_url).to.be.equal('https://partner-uat.growthsourceft.com');
            expect(datasource.security).to.be.eql([{"ApiKey":"plpinelabs"},{"ApiToken":"679e36a018524e6dbfd3f184059b29f0"}]);
            expect(datasource.securitySchemes).to.be.eql({"ApiKey":{"type":"apiKey","in":"header","name":"x-api-key"},"ApiToken":{"type":"apiKey","in":"header","name":"Authorization"}});
        } catch(error) {
            fail(<Error>error);
        }
    });
    it('should load kafka datasource', async () => {
        try {
            logger.debug('pathString: %s',pathString);
            const datasources = await loadDatasources(pathString);
            const datasource = datasources.kafka1({}, {}, {}, {});
            logger.debug('result:kafka1: %o',datasource);
  
             expect(datasource).to.have.keys('client_id','type','client','brokers');
            expect(datasource.client).to.have.keys('consumers','config','kafka','subscribers');
            expect(datasource.client_id).to.be.equal("kafka_proj");
            expect(datasource.type).to.be.equal('kafka');
           
        } catch(error) {
            fail(<Error>error);
        }
    });
});
       
