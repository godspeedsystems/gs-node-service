import { Span, SpanContext, diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { Message } from 'kafkajs';
import { KafkaJsInstrumentation } from 'opentelemetry-instrumentation-kafkajs';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { config } from '../core/loader';  // eslint-disable-line

const opentelemetry = require("@opentelemetry/sdk-node");
//Disable all autoinstrumentations because they do logging of all express middleware also.
//const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-grpc');

const traceExporter = new OTLPTraceExporter();

const tracerProvider = new NodeTracerProvider({
  plugins: {
    kafkajs: { enabled: false, path: 'opentelemetry-plugin-kafkajs' }
  }
});

// For troubleshooting, set the log level to DiagLogLevel.DEBUG
//const configLogLevel: DiagLogLevel = config.app.config.telemetry?.log_level || DiagLogLevel.DEBUG;
//diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const sdk = new opentelemetry.NodeSDK({
  tracerProvider,
  traceExporter,//: new opentelemetry.tracing.ConsoleSpanExporter(),
  instrumentations: [ new HttpInstrumentation({
                          requestHook: (span: any, request: any) => {
                              if (span.attributes.span_operation === 'INCOMING' ) {
                                span.updateName(span.name + " (Incoming)");

                                const spanCtx: SpanContext = span.spanContext();
                                span.setAttributes({
                                  'traceId': spanCtx.traceId,
                                  'spanId': spanCtx.spanId
                                });
                            } else {
                                span.updateName(span.name + " (Outgoing)");
                                
                                const spanCtx: SpanContext = span.spanContext();
                                span.setAttributes({
                                  'traceId': spanCtx.traceId,
                                  'spanId': spanCtx.spanId
                                });
                              }
                          },
                          startIncomingSpanHook: (request: any) => {
                            return { span_operation: 'INCOMING' };
                          }
                      }),
                      ExpressInstrumentation, 
                      new KafkaJsInstrumentation({
                        producerHook: (span: Span, topic: string, message: Message) => {
                          span.updateName('Kafka producer: ' + topic);

                          const spanCtx: SpanContext = span.spanContext();
                          span.setAttributes({
                            'traceId': spanCtx.traceId,
                            'spanId': spanCtx.spanId
                          });
                        },
                        consumerHook: (span: Span, topic: string, message: Message) => {
                          span.updateName('Kafka consumer: ' + topic);

                          const spanCtx: SpanContext = span.spanContext();
                          span.setAttributes({
                            'traceId': spanCtx.traceId,
                            'spanId': spanCtx.spanId
                          });
                        }
                      }),
                      new PinoInstrumentation({})
                    ],
                    ignoreLayers: true 
});

//const { logger } = require('../core/logger');
// sdk.start()
//   .then(() => logger.info('Tracing initialized'))
//   .catch((error: any) => logger.error('Error initializing tracing', error));

// // gracefully shut down the SDK on process exit
// process.on('SIGTERM', () => {
//   sdk.shutdown()
//     .then(() => logger.info('Tracing terminated'))
//     .catch((error: any) => logger.error('Error terminating tracing', error))
//     .finally(() => process.exit(0));
// });

sdk.start()
  .then(() => console.log('Tracing initialized'))
  .catch((error: any) => console.error('Error initializing tracing', error));

// gracefully shut down the SDK on process exit
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error: any) => console.error('Error terminating tracing', error))
    .finally(() => process.exit(0));
});
