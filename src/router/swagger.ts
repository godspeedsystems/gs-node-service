import config from 'config';
import { PlainObject } from "../types";

const port = process.env.PORT || 3000;
const customServerUrl = (config as any).server_url || `http://localhost:${port}`;


const swaggerCommonPart = {
  "openapi": "3.0.0",
  "info": {
    "version": "0.0.1",
    "title": "Godspeed: Sample Microservice",
    "description": "Sample API calls demonstrating the functionality of Godspeed framework",
    "termsOfService": "http://swagger.io/terms/",
    "contact": {
      "name": "Mindgrep Technologies Pvt Ltd",
      "email": "talktous@mindgrep.com",
      "url": "https://docs.mindgrep.com/docs/microservices/intro"
    },
    "license": {
      "name": "Apache 2.0",
      "url": "https://www.apache.org/licenses/LICENSE-2.0.html"
    }
  },
  "servers": [{
    "url": "http://localhost:3001"
  }],
  "paths": {}
};


export const generateSwaggerJSON = (events: PlainObject, definitions: PlainObject) => {

  const finalSpecs = JSON.parse(JSON.stringify(swaggerCommonPart)); // deep clone

  Object.keys(events).forEach(event => {
    let apiEndPoint = event.split('.')[0];
    apiEndPoint = apiEndPoint.replace(/:([^\/]+)/g, '{$1}'); //We take :path_param. OAS3 takes {path_param}
    const method = event.split('.')[2];
    const eventSchema = events[event];

    //Initialize the schema for this method, for given event
    let methodSpec: PlainObject = {
      summary: eventSchema.summary,
      description: eventSchema.description,
      requestBody: eventSchema.body || eventSchema.data?.schema?.body,
      parameters:
        eventSchema.parameters ||
        eventSchema.params ||
        eventSchema.data?.schema?.params,
      responses: eventSchema.responses,
    };

    //Set it in the overall schema
    // @ts-ignore
    finalSpecs.paths[apiEndPoint] = {
      // @ts-ignore
      ...finalSpecs.paths[apiEndPoint],
      [method]: methodSpec,
    };
  });

  finalSpecs.definitions = definitions;

  return finalSpecs;
};