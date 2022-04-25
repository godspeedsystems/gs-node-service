import Ajv from "ajv"
import addFormats from "ajv-formats";
import iterate_yaml_directories from './configLoader';
import * as _ from "lodash";
import { GSCloudEvent , GSActor , GSStatus } from "../core/interfaces";
import { PlainObject } from "./common";
import loadModules from "./codeLoader";
const ajv = new Ajv()

let config:{[key:string]:any;} = {}

async function loadSources() {
    console.log(process.argv[2])
    config.app = iterate_yaml_directories(process.argv[2]).src;
    console.log("config.app: ",config.app)
}

function loadJsonValidation() {
    const eventObj:any = config.app.events

    // Add formats to ajv instance
    addFormats(ajv);

    Object.keys(eventObj).forEach(function(topic) {
        // Add body schema in ajv for each content_type per topic
        /* TODO: Right now, we are assuming that there is going to be one content_type only i.e. application/json
                This needs to be enhanced in fututre when multiple content_type will be supported
        */
        const body_content= eventObj[topic]?.data?.schema?.body?.content;
        if (body_content) {
            Object.keys(body_content).forEach(function(k) {
                const content_schema = body_content[k]['schema'];
                if(content_schema) {
                    ajv.addSchema(content_schema, topic)
                }
            });
        }

        // Add params schema in ajv for each param per topic
        const params = eventObj[topic]?.data?.schema?.params;

        if (params) {
            Object.keys(params).forEach(function(k) {
                if(params[k]['schema']) {
                    const topic_param = topic + ':'+ params[k]['name']
                    ajv.addSchema(params[k]['schema'], topic_param)
                }
            });
        }

        // Add responses schema in ajv for each response per topic
        const responses = eventObj[topic]?.responses;
        if (responses) {
            Object.keys(responses).forEach(function(k) {
                const response_s = responses[k]?.schema?.data?.content?.['application/json']?.schema;
                if (response_s) {
                    const response_schema = response_s
                    const topic_response = topic + ':responses:'+ k
                    //console.log("topic_response: ",topic_response)
                    ajv.addSchema(response_schema, topic_response)
                }
            });
        }

    });
}

/* Function to validate GSCloudEvent */
function validateSchema(topic: string, event: any): PlainObject{
    let status:PlainObject= {};
    console.log("event.data['body']: ",event.data['body'])
    console.log("event.data['params']: ",event.data['params'])

    // Validate event.data['body']
    if(event.data['body'])
    {
        //console.log("ajvschemas: ",ajv.schemas[topic])
        const ajv_validate = ajv.getSchema(topic)
        if(ajv_validate !== undefined)
        {
            //console.log("ajv_validate: ",ajv_validate)
            if (! ajv_validate(event.data['body'])) {
                console.log("! ajv_validate: ")
                status.success = false
                status.error = ajv_validate.errors
            }
            else{
                console.log("ajv validated")
                status.success = true
            }
        }
        else{
            status.success = true
        }
    }
    else {
        status.success = false
        status.error = "Body not present"
    }

    // Validate event.data['params']
    if(event.data.params) {
        _.each(event.data['params'], (paramObj, param) => {
        const topic_param = topic + ':'+ param
        const ajv_validate = ajv.getSchema(topic_param)
        if(ajv_validate !== undefined)
        {
            if (! ajv_validate(paramObj)) {
                status.success = false
                status.error = ajv_validate.errors
                return false
            }
            else {
                status.success = true
                return true
            }
        }
        })
    }
    return status
}

/* Function to validate GSStatus */
function validateResponse(topic: string, gs_status: GSStatus): PlainObject{
    let status:PlainObject= {};
    //console.log("gs_status: ",gs_status)

    if(gs_status.data)
    {
        const topic_response = topic + ':responses:' + gs_status.code
        const ajv_validate = ajv.getSchema(topic_response)
        if(ajv_validate !== undefined)
        {
            //console.log("ajv_validate: ",ajv_validate)
            if (! ajv_validate(gs_status.data)) {
                console.log("! ajv_validate: ")
                status.success = false
                status.error = ajv_validate.errors
            }
            else{
                console.log("ajv validated")
                status.success = true
            }
        }
        else{
            status.success = true
        }
    }
    else {
        status.success = false
        status.error = "Response data is not present"
    }
    return status
}

(async() => {
    await loadSources();
    loadJsonValidation();
})();


export { config , validateSchema , validateResponse };

if (require.main === module) {
    const actor: GSActor = {
        type: "user",
        tenant_id: "43",
        name: "user_name",
        id: "44",
        data: {}
      };
      const time:Date= new Date("2022/04/19");
      const new_event = new GSCloudEvent("1","type",time,"source","1.0",{ "body": {"id": "Smith"}, "params": {"bank_id": "HDB01"} },"REST",actor,{})

      // Call validate function to validate event.data (body and params)
      const valid = validateSchema("/do_kyc/{bank_id}.http.post",new_event);
      console.log(valid);
}
