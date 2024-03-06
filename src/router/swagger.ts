import def from "ajv/dist/vocabularies/discriminator";
import { PlainObject } from "../types";

// Define the type of eventSourceConfig
type EventSourceConfig = {
  port: number;
  jwt?: PlainObject //For v1 compatibility
  authn?: {
    jwt?: PlainObject //V2 has all authentication configs in authn
  }
  docs?: {
    info: any; // Adjust the type as needed
    servers: any[]; // Adjust the type as needed
  };
};

export const generateSwaggerJSON = (events: PlainObject, definitions: PlainObject, eventSourceConfig: EventSourceConfig) => {

  const finalSpecs: { [key: string]: any } = { openapi: "3.0.0", paths: {} };

  const { port, docs } = eventSourceConfig;
  const info = docs?.info;
  const servers = docs?.servers;
  const jwt = eventSourceConfig.authn?.jwt || eventSourceConfig.jwt;
  const eventObjStr = JSON.stringify(events);
  const modifiedStr = eventObjStr.replace(/https:\/\/godspeed\.systems\/definitions\.json/g, '');
  const eventObj = JSON.parse(modifiedStr);

  Object.keys(eventObj).forEach(event => {
    let apiEndPoint = event.split('.')[2];
    apiEndPoint = apiEndPoint.replace(/:([^\/]+)/g, '{$1}'); //We take :path_param. OAS3 takes {path_param}
    const method = event.split('.')[1];
    const eventSchema = eventObj[event];
    const eventAuthn = jwt && eventSchema.authn !== false;
    //Initialize the schema for this method, for given event
    let methodSpec: PlainObject = {
      summary: eventSchema.summary,
      description: eventSchema.description,
      tags: eventSchema.tags,
      operationId: eventSchema.operationId || eventSchema.id || eventSchema.summary?.replace(' ', '_') || `${method}_${apiEndPoint}`.replace(/\//g, '_'),
      requestBody: eventSchema.body,
      parameters: eventSchema.params,
      responses: eventSchema.responses,
      ...(eventAuthn && {
        security: [{
          bearerAuth: []
        },]
      })
    };

    //Set it in the overall schema
    // @ts-ignore

    finalSpecs.paths[apiEndPoint] = {
      // @ts-ignore
      ...finalSpecs.paths[apiEndPoint],
      [method]: methodSpec,
    };
  });

  if (servers && Array.isArray(servers)) {
    finalSpecs.servers = servers;
  } else {
    finalSpecs.servers = [{
      "url": `http://localhost:${port}`
    }];
  }

  finalSpecs.info = info;

  setDefinitions(finalSpecs, definitions);
  
  if (jwt) {
    finalSpecs.components.securitySchemes = {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      }
    };
  }


  return finalSpecs;
};

function setDefinitions(finalSpecs: PlainObject, definitions: PlainObject) {
  definitions = JSON.parse(JSON.stringify(definitions));
  //Flatten the definitions object to store as component schema as per swagger format
  const removedKeys: string[] = [];
  Object.keys(definitions).forEach((key) => {
    if (!definitions[key]?.type) {
      const innerObj = definitions[key];
      delete definitions[key];
      removedKeys.push(key);
      definitions = { ...definitions, ...innerObj };
    }
  });
  //finalSpecs.definitions = definitions;
  finalSpecs.components = {
    schemas: definitions
  };
  for (let key of removedKeys) {
    replaceStringInJSON(finalSpecs, `#/definitions/${key}/`, "#/components/schemas/");
  }
}

function replaceStringInJSON(jsonObj: PlainObject, stringToMatch: string, replacementString: string) {
  if (jsonObj === null) {
    return;
  }

  // If jsonObj is an array, iterate through its elements
  if (Array.isArray(jsonObj)) {
    for (let i = 0; i < jsonObj.length; i++) {
      jsonObj[i] = replaceStringInJSON(jsonObj[i], stringToMatch, replacementString);
    }
  } else if (typeof jsonObj === 'object') {
    // Iterate through the object keys
    for (let key in jsonObj) {
      if (jsonObj.hasOwnProperty(key)) {
        // Recursively call the function for nested objects or arrays
        jsonObj[key] = replaceStringInJSON(jsonObj[key], stringToMatch, replacementString);
      }
    }
  } else if (typeof jsonObj === 'string') {
    // If jsonObj is a leaf string value and contains the string to match, replace it
    if ((jsonObj as string).includes(stringToMatch)) {
      return (jsonObj as string).replace(new RegExp(stringToMatch, 'g'), replacementString);
    }
  }



  return jsonObj;
}
