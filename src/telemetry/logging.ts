import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

const provider = new NodeTracerProvider();
provider.register();

registerInstrumentations({
  instrumentations: [
    new PinoInstrumentation({
      // Optional hook to insert additional context to log object.
      // logHook: (span, record, level) => {
      //   record['resource.service.name'] = provider.resource.attributes['service.name'];
      // },
    }),
    // other instrumentations
  ],
});