import promClient from 'prom-client';

//const register = new promClient.Registry();
const defaultLabels = { serviceName: process.env.OTEL_SERVICE_NAME || 'unknown_service:node' };
promClient.register.setDefaultLabels(defaultLabels);

const labels = ['topic', 'partition', 'status'];
const kafkaCount = new promClient.Counter({
    name: 'kafka_events_total',
    help: 'Counter for total kafka events consumed',
    labelNames: labels
});

const kafkaDuration = new promClient.Histogram({
    name: 'kafka_events_duration_seconds',
    help: 'Duration of Kafka events in seconds',
    labelNames: labels
});

export { promClient, kafkaCount, kafkaDuration };

/* Commenting the code for now as we are using prometheus metrics as middleware and exposing them on /metrics */

// import { config } from '../core/loader';  // eslint-disable-line
// 'use strict';

// const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-grpc');
// const { MeterProvider, PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics-base');

// const metricExporter = new OTLPMetricExporter({});
// const meterProvider = new MeterProvider({});

// meterProvider.addMetricReader(new PeriodicExportingMetricReader({
//   exporter: metricExporter,
//   exportIntervalMillis: config.app.config.telemetry?.metrics?.export?.interval || 60000,
// }));
// const meter = meterProvider.getMeter('gs-exporter-collector');

// require('opentelemetry-node-metrics')(meterProvider);
