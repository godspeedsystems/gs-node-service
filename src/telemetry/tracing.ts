/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { SpanContext, diag, DiagConsoleLogger } from '@opentelemetry/api';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { getEnv } from '@opentelemetry/core';
import { PrismaInstrumentation } from '@prisma/instrumentation';

import { NodeSDK } from "@opentelemetry/sdk-node";
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';;

let traceExporter;

if (process.env.NODE_ENV != 'dev') {
  traceExporter = new OTLPTraceExporter();
} else {
  traceExporter = new ConsoleSpanExporter();
  process.env.OTEL_TRACES_SAMPLER = 'parentbased_traceidratio';
  process.env.OTEL_TRACES_SAMPLER_ARG = "0.25";
}

diag.setLogger(new DiagConsoleLogger(), getEnv().OTEL_LOG_LEVEL);

const sdk = new NodeSDK({
  traceExporter: traceExporter,
  instrumentations: [new HttpInstrumentation({
    requestHook: (span: any, request: any) => {
      if (span.attributes.span_operation === 'INCOMING') {
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
  new PinoInstrumentation({}),
  new PrismaInstrumentation(),
  ]
});

//const { logger } = require('../core/logger');
// sdk.start()
//   .then(() => console.log('Tracing initialized'))
//   .catch((error: any) => logger.error('Error initializing tracing', error));

// // gracefully shut down the SDK on process exit
// process.on('SIGTERM', () => {
//   sdk.shutdown()
//     .then(() => console.log('Tracing terminated'))
//     .catch((error: any) => logger.error('Error terminating tracing', error))
//     .finally(() => process.exit(0));
// });


export const initialize = () => {
  sdk.start();
};