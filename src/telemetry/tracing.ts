import { logger } from '../core/logger';
const opentelemetry = require("@opentelemetry/sdk-node");
//Disable all autoinstrumentations because they do logging of all express middleware also.
//const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
const { KafkaJsInstrumentation } = require('opentelemetry-instrumentation-kafkajs');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-grpc');

const traceExporter = new OTLPTraceExporter();

const tracerProvider = new NodeTracerProvider({
  // be sure to disable old plugin
  plugins: {
    kafkajs: { enabled: false, path: 'opentelemetry-plugin-kafkajs' }
  }
});

// For troubleshooting, set the log level to DiagLogLevel.DEBUG
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const sdk = new opentelemetry.NodeSDK({
  tracerProvider,
  traceExporter,//: new opentelemetry.tracing.ConsoleSpanExporter(),
  instrumentations: [HttpInstrumentation, ExpressInstrumentation, new KafkaJsInstrumentation({})],
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