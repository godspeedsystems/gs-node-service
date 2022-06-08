import { config } from '../core/loader';  // eslint-disable-line
'use strict';

const { MeterProvider, ConsoleMetricExporter } = require('@opentelemetry/sdk-metrics-base');
const meter = new MeterProvider({
  exporter: new ConsoleMetricExporter(),
  interval: config.app.config.telemetry?.metrics?.export?.interval || 60000,
}).getMeter('gs-rquest-metrics');

const requestCounter = meter.createCounter("requests-count", {
  description: "Count all incoming requests"
});

const boundInstruments = new Map<string,any> ();

module.exports.countAllRequests = () => {
  return (req: any, res: any, next:any) => {
    if (!boundInstruments.has(req.path)) {
      const labels = { route: req.path };
      const boundCounter = function (count: number) {
        requestCounter.add(count, labels);
      };
      boundInstruments.set(req.path, boundCounter);
    }

    boundInstruments.get(req.path)(1);
    next();
  };
};