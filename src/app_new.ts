// /* eslint-disable no-loop-func */
// /*
//  * You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
//  * © 2022 Mindgrep Technologies Pvt Ltd
//  */

// import express from 'express';
// import {
//   GSActor,
//   GSCloudEvent,
// } from './core/interfaces';
// import config from 'config';
// import authn from './authn';
// import app, { router } from './http_listener';
// import { PlainObject } from './core/common';
// import { logger } from './core/logger';
// import { kafka } from './kafka';
// import _ from 'lodash';
// import { promClient } from './telemetry/monitoring';
// import salesforce from './salesforce';
// import cron from './cron';
// import { loadAndRegisterDefinitions } from './core/definitionsLoader';
// import loadMappings from './core/mappingLoader';
// import loadDatasources from './core/datasourceLoader';
// import { loadFunctions } from './core/functionLoader';
// import { compileScript } from './core/utils';
// import loadModules from './core/codeLoader';
// import { importAll } from './scriptRuntime';
// import loadEvents from './core/eventLoader';

// let mappings: PlainObject;

// const subscribeToEvent = (events: any, datasources: PlainObject, processEvent: (GSCloudEvent) => Promise<any>) => {
//   for (let route in events) {
//     let originalRoute = route;
//     if (route.includes('.http.') || route.includes('.webhook')) {
//       let method = 'get';
//       let required = !!config.has('jwt');

//       if ('authn' in events[originalRoute]) {
//         required = events[originalRoute].authn;
//       }

//       // @ts-ignore
//       router[method](
//         route,
//         authn(required),
//         function (request: express.Request, response: express.Response) {
//           // log the request
//           console.log(
//             'originalRoute: %s %o %o',
//             originalRoute,
//             request.params,
//             request.files
//           );

//           //passing all properties of req
//           const reqProp = _.omit(request, [
//             '_readableState',
//             'socket',
//             'client',
//             '_parsedUrl',
//             'res',
//             'app'
//           ]);

//           const reqHeaders = _.pick(request, ['headers']);

//           let data = { ...reqProp, ...reqHeaders };

//           //@ts-ignore
//           data.file_obj = request.files;
//           //@ts-ignore
//           data.files = Object.values(request.files || {});
//           console.log('inputs %o', data);

//           const event = new GSCloudEvent(
//             'id',
//             originalRoute,
//             new Date(),
//             'http',
//             '1.0',
//             data,
//             'REST',
//             new GSActor('user'),
//             { http: { express: { response } } }
//           );

//           processEvent(event);
//         }
//       );

//     } else if (route.includes('.kafka')) {
//       let [topic, groupId] = route.split('.kafka.');
//       console.log('registering kafka handler %s %s', topic, groupId);
//       kafka.subscribe(topic, groupId, 'kafka', processEvent);
//     } else if (route.includes('.salesforce.')) {
//       let [topic, datasourceName] = route.split('.salesforce.');
//       console.log(
//         'registering salesforce handler %s %s',
//         topic,
//         datasourceName
//       );
//       salesforce.subscribe(topic, datasourceName, processEvent);
//     } else if (route.includes('.cron.')) {
//       cron(route, processEvent);
//     } else {
//       // for kafka event source like {topic}.kafka1.{groupid}
//       // for rabbitmq event source like {queue}.rabbitmq1
//       // here we are assuming that various event sources for kafka are defined in the above format.
//       let [topic, datasource] = route.split('.', 2);

//       // find the client corresponding to datasource from the datasources
//       if (datasource in datasources) {
//         try {
//           const evaluatedDatasources = datasources[datasource](
//             config,
//             {},
//             {},
//             mappings
//           );
//           console.log('evaluatedDatasources: %o', evaluatedDatasources);
//           const client = evaluatedDatasources.client;
//           console.log(
//             'registering %s handler, topic %s',
//             route,
//             topic,
//           );

//           client.subscribe(route, datasource, processEvent);
//         } catch (err: any) {
//           logger.error(
//             'Caught error in registering handler: %s, error: %o',
//             route,
//             err
//           );
//           process.exit(1);
//         }
//       } else {
//         logger.error(
//           'Client not found for %s in datasources. Exiting.',
//           datasource
//         );
//         process.exit(1);
//       }
//     }
//   }
// };

// const attachHelperRoutes = (datasources: PlainObject) => {
//   // Expose metrics for all prisma clients, node and express on /metrics
//   app.get('/metrics', async (req: express.Request, res: express.Response) => {
//     let prismaMetrics: string = '';
//     for (let ds in datasources) {
//       if (datasources[ds].type === 'datastore') {
//         const prismaClient = datasources[ds].client;
//         prismaMetrics += await prismaClient.$metrics.prometheus({
//           globalLabels: { server: process.env.HOSTNAME, datasource: `${ds}` }
//         });
//       }
//     }
//     let appMetrics = await promClient.register.metrics();
//     res.end(appMetrics + prismaMetrics);
//   });

//   // @ts-ignore
//   const baseUrl = config.base_url || '/';
//   app.use(baseUrl, router);
// };

// const main = async () => {
//   console.log('Main execution NODE_ENV: %s', process.env.NODE_ENV);
//   const PROJECT_ROOT_DIRECTORY = '';

//   let functions: PlainObject;

//   // definitions
//   await loadAndRegisterDefinitions(PROJECT_ROOT_DIRECTORY + '/definitions');

//   // mappings
//   mappings = loadMappings();

//   // datasources
//   const datasources = await loadDatasources(
//     PROJECT_ROOT_DIRECTORY + '/datasources'
//   );

//   // @ts-ignore
//   global.datasources = _.clone(datasources);

//   // functions
//   const loadFnStatus = await loadFunctions(
//     datasources,
//     PROJECT_ROOT_DIRECTORY + '/functions'
//   );

//   if (loadFnStatus.success) {
//     functions = loadFnStatus.functions;
//   } else {
//     logger.error('Unable to load functions exiting...');
//     process.exit(1);
//   }

//   // load authn, before_method_hook, after_method_hook workflow in datasources
//   for (let ds in datasources) {
//     if (datasources[ds].authn) {
//       datasources[ds].authn = functions[datasources[ds].authn];
//     }

//     if (datasources[ds].before_method_hook) {
//       datasources[ds].before_method_hook =
//         functions[datasources[ds].before_method_hook];
//     }

//     if (datasources[ds].after_method_hook) {
//       datasources[ds].after_method_hook =
//         functions[datasources[ds].after_method_hook];
//     }

//     datasources[ds].gsName = ds;
//     let datasourceScript = compileScript(datasources[ds]);
//     console.log('datasourceScript: %s', datasourceScript);
//     datasources[ds] = datasourceScript;
//   }

//   // load and register plugins
//   const plugins = await loadModules(__dirname + '/plugins', true);
//   importAll(plugins, global);

//   // events
//   const events = await loadEvents(
//     functions,
//     PROJECT_ROOT_DIRECTORY + '/events'
//   );

//   // now we can call subscribe to events, which will attach the process event function with each kinda event
//   const processEvent = (event: GSCloudEvent): Promise<void> => { };
//   subscribeToEvent(events, datasources, processEvent);
// };