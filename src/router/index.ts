// import bodyParser from 'body-parser';
// import express from 'express';
// import { pinoHttp } from 'pino-http';
// import fileUpload from 'express-fileupload';
// import promMid from '@mindgrep/express-prometheus-middleware';
// import Prometheus from 'prom-client';
// import swaggerUI from 'swagger-ui-express';
// import config from 'config';

// import { logger } from '../logger';
// import { PlainObject } from '../types';
// import { promClient } from '../telemetry/monitoring';
// import { generateSwaggerJSON } from './swagger';


// // here we are going to configure all the routes of the application
// // like, /api-docs, /metrics

// const prepareRouter = async (app: express.Application, datasources: PlainObject, events: PlainObject, definitions: PlainObject) => {

//   const loggerExpress = pinoHttp({
//     logger: logger,
//     autoLogging: true,
//   });

//   // @ts-ignore
//   const request_body_limit = config.request_body_limit || 50 * 1024 * 1024;

//   // @ts-ignore
//   const file_size_limit = config.file_size_limit || 50 * 1024 * 1024;

//   app.use(bodyParser.urlencoded({ extended: true, limit: request_body_limit }));
//   app.use(bodyParser.json({ limit: request_body_limit }));
//   app.use(loggerExpress);

//   // file upload
//   app.use(
//     fileUpload({
//       useTempFiles: true,
//       //@ts-ignore
//       limits: { fileSize: file_size_limit },
//     })
//   );

//   // prometheus middleware
//   app.use(
//     promMid({
//       collectDefaultMetrics: true,
//       requestDurationBuckets: Prometheus.exponentialBuckets(0.2, 3, 6),
//       requestLengthBuckets: Prometheus.exponentialBuckets(512, 2, 10),
//       responseLengthBuckets: Prometheus.exponentialBuckets(512, 2, 10),
//     })
//   );

//   // expose metrics route
//   app.get('/metrics', async (req: express.Request, res: express.Response) => {
//     let prismaMetrics: string = '';
//     for (let ds in datasources) {
//       if (datasources[ds].type === 'datastore') {
//         const prismaClient = datasources[ds].client;
//         prismaMetrics += await prismaClient.$metrics.prometheus({
//           globalLabels: { server: process.env.HOSTNAME, datasource: `${ds}` },
//         });
//       }
//     }
//     let appMetrics = await promClient.register.metrics();
//     res.end(appMetrics + prismaMetrics);
//   });

//   // expose SwaggerUI
//   const swaggerJson = generateSwaggerJSON(events, definitions);

//   app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerJson));
// };

// export { prepareRouter };