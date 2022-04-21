import Ajv from "ajv"
import addFormats from "ajv-formats";
import iterate_yaml_directories from './configLoader';
import * as _ from "lodash";
import { GSCloudEvent , GSActor } from "../core/interfaces";
const ajv = new Ajv()

let config:{[key:string]:any;} = {}

function loadSources() {
    var events:any;
    config.app = iterate_yaml_directories( __dirname + '/../../src').src;
    console.log("config.app: ",config.app)
    //loader['events'] = events['events']
}

/*
function loadFunctions() {
    var functions:any;
    functions = iterate_yaml_directories( __dirname + '/../../src/functions');
    loader['functions'] = functions['functions']
}

function loadDataSources() {
    var datasources:any;
    datasources = iterate_yaml_directories( __dirname + '/../../src/datasources');
    loader['datasources'] = datasources['datasources']
}
*/
function loadJsonValidation() {
    const eventObj:any = config.app.events

    // Add formats to ajv instance
    addFormats(ajv);

    Object.keys(eventObj).forEach(function(topic) {
        // Add body schema in ajv for each content_type per topic
        /* TODO: Right now, we are assuming that there is going to be one content_type only i.e. application/json
                This needs to be enhanced in fututre when multiple content_type will be supported
        */
        const body_content= eventObj[topic]['data']['schema']['body']['content'];
        Object.keys(body_content).forEach(function(k) {
            const content_schema = body_content[k]['schema'];
            if(content_schema) {
                ajv.addSchema(content_schema, topic)
            }
        });

        // Add params schema in ajv for each param per topic
        const params= eventObj[topic]['data']['schema']['params'];

        Object.keys(params).forEach(function(k) {
            if(params[k]['schema']) {
                const topic_param = topic + ':'+ params[k]['name']
                ajv.addSchema(params[k]['schema'], topic_param)
            }
        });
    });
}

/* Function to validate GSCloudEvent */
function validate(topic: string, event: GSCloudEvent): boolean {    
    let status=false

    // Validate event.data['body']
    if(event.data['body'])
    {
        const ajv_validate = ajv.getSchema(topic)
        if(ajv_validate !== undefined)
        {
            if (! ajv_validate(event.data['body'])) {
              return false
          } 
        }
        else{
            return false
        } 
    }
    else {
        return false
    }
  
    // Validate event.data['params']
    _.each(event.data['params'], (paramObj, param) => {
      const topic_param = topic + ':'+ param
      const ajv_validate = ajv.getSchema(topic_param)
      if(ajv_validate !== undefined)
      {
          if (! ajv_validate(paramObj)) {
          status=false
          return false
          }
          else {
          status=true
          return true
          }
      }
    })
    return status
}

loadSources();
loadJsonValidation();

export { config , validate };

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
      const valid = validate("/do_kyc/{bank_id}.http.post",new_event);
      console.log(valid);    
}
