import { describe, it, expect, glob, path, fs, expectObj } from './common';
import { loadFunctions } from '../core/functionLoader';
import { fail } from 'assert';
import { GSFunction, GSSeriesFunction, GSParallelFunction, GSSwitchFunction } from '../core/interfaces';
import { PlainObject } from '../core/common';

const testName = path.basename(__filename).split('.')[0]
const pathString:string = path.join(__dirname, 'fixtures', testName, '/functions')
const datasources:PlainObject = {
    "growthsource": {
        "client": {
            "base_url": "https://partner-uat.growthsourceft.com"
        },
        "schema": false
    },
    "lender_integration": {
        "client": {
            "base_url": "https://raw.githubusercontent.com/Kong/swagger-ui-kong-theme/main/demo/public/specs/httpbin.yaml"
        },
        "schema": true
  }
}

describe(testName, () => {
    it('should load subWorkflows successfully', async () => {
        try {
            const result = await loadFunctions(datasources, pathString);
            const sub_wf_function = result.functions['another_wf'];
            //expect(result).to.be.equal({success: true});
            expect(result.success).to.be.equal(true);

            // Check another_wf nested properties
            expect(sub_wf_function).to.be.instanceOf(GSSeriesFunction)
            expect(sub_wf_function.args[0]).to.be.instanceOf(GSFunction)
            expect(sub_wf_function.args[0].fn).to.be.instanceOf(GSSeriesFunction)
            expect(sub_wf_function.args[0].fn.args[0]).to.be.instanceOf(GSParallelFunction)
            expect(sub_wf_function.args[0].fn.args[0].args[0]).to.be.instanceOf(GSFunction)
            expect(sub_wf_function.args[0].fn.args[0].args[0].fn).to.be.instanceOf(Function)
            expect(sub_wf_function.args[0].fn.args[0].args[1]).to.be.instanceOf(GSFunction)
            expect(sub_wf_function.args[0].fn.args[0].args[1].fn).to.be.instanceOf(Function)
            expect(sub_wf_function.args[0].fn.args[0].args[2]).to.be.instanceOf(GSFunction)
            expect(sub_wf_function.args[0].fn.args[0].args[2].fn).to.be.instanceOf(Function)
            expect(sub_wf_function.args[0].fn.args[1]).to.be.instanceOf(GSFunction)
            expect(sub_wf_function.args[0].fn.args[1].fn).to.be.instanceOf(Function)
        } catch(error) {
            fail(<Error>error);
        }
    });
    it('should load switch workflow successfully', async () => {
        try {
            const result = await loadFunctions(datasources, pathString);
            const wf_function = result.functions['switch_wf'];
            expect(result.success).to.be.equal(true);

            // Check another_wf nested properties
            expect(wf_function).to.be.instanceOf(GSSeriesFunction)
            expect(wf_function.args[0]).to.be.instanceOf(GSSwitchFunction)
            expect(wf_function.args[0].args[0]).to.be.equal('<% inputs.body.condition %>')
            expect(wf_function.args[0].args[1]).to.be.an('Object')
            expect(wf_function.args[0].args[1].FIRST).to.be.instanceOf(GSFunction)
            expect(wf_function.args[0].args[1].FIRST.fn).to.be.instanceOf(Function)
            expect(wf_function.args[0].args[1].SECOND).to.be.instanceOf(GSFunction)
            expect(wf_function.args[0].args[1].SECOND).to.be.instanceOf(Function)
            expect(wf_function.args[0].args[1].THIRD).to.be.instanceOf(GSFunction)
            expect(wf_function.args[0].args[1].THIRD.fn).to.be.instanceOf(Function)
            expect(wf_function.args[0].args[1].default).to.be.instanceOf(GSFunction)
            expect(wf_function.args[0].args[1].default.fn).to.be.instanceOf(Function)
            expect(wf_function.args[1]).to.be.instanceOf(GSFunction)
            expect(wf_function.args[1].fn).to.be.instanceOf(Function)
        } catch(error) {
            fail(<Error>error);
        }
    });
});
       
