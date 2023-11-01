import { PlainObject } from "../types";

export const generateSwaggerJSON = (events: PlainObject, definitions: PlainObject, eventSourceConfig: PlainObject) => {

  const finalSpecs: { [key: string]: any } = { openapi: "3.0.0", paths: {} };

  const { port, docs: { info } } = eventSourceConfig;

  Object.keys(events).forEach(event => {
    let apiEndPoint = event.split('.')[2];
    apiEndPoint = apiEndPoint.replace(/:([^\/]+)/g, '{$1}'); //We take :path_param. OAS3 takes {path_param}
    const method = event.split('.')[1];
    const eventSchema = events[event];

    //Initialize the schema for this method, for given event
    let methodSpec: PlainObject = {
      summary: eventSchema.summary,
      description: eventSchema.description,
      requestBody: eventSchema.body,
      parameters: eventSchema.params,
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

  finalSpecs.servers = [{
    "url": `http://localhost:${port}`
  }];
  finalSpecs.info = info;
  finalSpecs.definitions = definitions;

  return finalSpecs;
};