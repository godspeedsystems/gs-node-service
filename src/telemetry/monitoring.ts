import { config } from '../core/loader';  // eslint-disable-line
'use strict';

const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-grpc');
const { MeterProvider, PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics-base');

const metricExporter = new OTLPMetricExporter({});
const meterProvider = new MeterProvider({});

meterProvider.addMetricReader(new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: config.app.config.telemetry?.metrics?.export?.interval || 60000,
}));
const meter = meterProvider.getMeter('example-exporter-collector');

// Create counter and histogram for datastore metrics
const datastoreCounter = meter.createCounter('datastore_requests', {
  description: 'Counter of datastore requests',
});
const datastoreHistogram = meter.createHistogram('datastore_histogram', {
  description: 'Histogram of datastore requests',
});

require('opentelemetry-node-metrics')(meterProvider)

export { datastoreCounter, datastoreHistogram };
