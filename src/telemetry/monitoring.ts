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
const meter = meterProvider.getMeter('gs-exporter-collector');

require('opentelemetry-node-metrics')(meterProvider);
