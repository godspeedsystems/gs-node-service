const opentelemetry = require("@opentelemetry/sdk-node");
//Disable all autoinstrumentations because they do logging of all express middleware also.
//const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
const { KafkaJsInstrumentation } = require('opentelemetry-instrumentation-kafkajs');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-grpc');

import { logger } from '../core/logger';


const traceExporter = new OTLPTraceExporter();

// For troubleshooting, set the log level to DiagLogLevel.DEBUG
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const sdk = new opentelemetry.NodeSDK({
  traceExporter,//: new opentelemetry.tracing.ConsoleSpanExporter(),
  instrumentations: [HttpInstrumentation, ExpressInstrumentation, KafkaJsInstrumentation],
  ignoreLayers: true
});

sdk.start()
  .then(() => logger.info('Tracing initialized'))
  .catch((error: any) => logger.error('Error initializing tracing', error));

// gracefully shut down the SDK on process exit
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => logger.info('Tracing terminated'))
    .catch((error: any) => logger.error('Error terminating tracing', error))
    .finally(() => process.exit(0));
});