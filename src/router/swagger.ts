import { PlainObject } from "../types";
import fs from 'fs';
export const generateSwaggerJSON = (events: PlainObject, definitions: PlainObject, eventSourceConfig: PlainObject) => {

  const finalSpecs: { [key: string]: any } = { openapi: "3.0.0", paths: {} };

  const { port, docs: { info, servers } } = eventSourceConfig;
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
  finalSpecs.definitions = definitions;

  if (jwt) {
    finalSpecs.components = {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    };
  }
  const swaggerDir = process.cwd() + '/docs/';
  fs.mkdirSync(swaggerDir, { recursive: true });
  fs.writeFileSync(swaggerDir + 'http-swagger.json', JSON.stringify(finalSpecs), 'utf-8');

  return finalSpecs;
};