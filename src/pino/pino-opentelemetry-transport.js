/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
'use strict';

const build = require('pino-abstract-transport');
const { SonicBoom } = require('sonic-boom');
const { once } = require('events');

const DEFAULT_MESSAGE_KEY = 'msg';

const ZEROS_FROM_MILLI_TO_NANO = '0'.repeat(6);

/**
 * @typedef {Object} CommonBindings
 * @property {string=} msg
 * @property {number=} level
 * @property {number=} time
 * @property {string=} hostname
 * @property {number=} pid
 *
 * @typedef {Record<string, string | number | Object> & CommonBindings} Bindings
 *
 */

/**
 * Pino OpenTelemetry transport
 *
 * Maps Pino log entries to OpenTelemetry Data model
 *
 * @typedef {Object} Options
 * @property {string | number} destination
 * @property {string} [messageKey="msg"]
 *
 * @param {Options} opts
 */
module.exports = async function (opts) {
  const destination = new SonicBoom({ dest: opts.destination, sync: false });
  const mapperOptions = {
    messageKey: opts.messageKey || DEFAULT_MESSAGE_KEY
  };
  const resourceOptions = {
    ...opts.Resource
  };

  return build(async function (/** @type { AsyncIterable<Bindings> } */ source) {
    for await (const obj of source) {
      const line = toOpenTelemetry(obj, mapperOptions, resourceOptions);
      let updatedLine;

      if (process.env.NODE_ENV != 'production') {
        let timestamp = parseInt(line.Timestamp.replace(ZEROS_FROM_MILLI_TO_NANO, ''));
        let date = new Date(timestamp);

        let dateString = new Intl.DateTimeFormat('en-IN', { dateStyle: 'short', timeStyle: 'medium',timeZone: 'Asia/Kolkata' }).format(date);
        updatedLine = `${dateString} [${line.SeverityText}] ${line.TraceId ?? ''} ${line.SpanId ?? ''} `+ Object.values(line.Attributes).join(' ') + ` ${line.Body}\n`;
      } else {
        updatedLine = JSON.stringify(line) + '\n';
      }

      const writeResult = destination.write(updatedLine);
      const toDrain = !writeResult;
      // This block will handle backpressure
      if (toDrain) {
        await once(destination, 'drain');
      }
    }
  }, {
    async close () {
      destination.end();
      await once(destination, 'close');
    }
  });
};

const FATAL_SEVERITY_NUMBER = 21;
/**
 * If the source format has only a single severity that matches the meaning of the range
 * then it is recommended to assign that severity the smallest value of the range.
 * https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/logs/data-model.md#mapping-of-severitynumber
 */
const SEVERITY_NUMBER_MAP = {
  10: 1,
  20: 5,
  30: 9,
  40: 13,
  50: 17,
  60: FATAL_SEVERITY_NUMBER
};

// https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/logs/data-model.md#displaying-severity
const SEVERITY_NAME_MAP = {
  1: 'TRACE',
  2: 'TRACE2',
  3: 'TRACE3',
  4: 'TRACE4',
  5: 'DEBUG',
  6: 'DEBUG2',
  7: 'DEBUG3',
  8: 'DEBUG4',
  9: 'INFO',
  10: 'INFO2',
  11: 'INFO3',
  12: 'INFO4',
  13: 'WARN',
  14: 'WARN2',
  15: 'WARN3',
  16: 'WARN4',
  17: 'ERROR',
  18: 'ERROR2',
  19: 'ERROR3',
  20: 'ERROR4',
  21: 'FATAL',
  22: 'FATAL2',
  23: 'FATAL3',
  24: 'FATAL4'
};

/**
 * Converts a pino log object to an OpenTelemetry log object.
 *
 * @typedef {Object} OpenTelemetryLogData
 * @property {string=} SeverityText
 * @property {string=} SeverityNumber
 * @property {string} Timestamp
 * @property {string} Body
 * @property {{ 'host.hostname': string, 'process.pid': number }} Resource
 * @property {Record<string, any>} Attributes
 *
 * @typedef {Object} MapperOptions
 * @property {string} messageKey
 *
 * @param {Bindings} sourceObject
 * @param {MapperOptions} mapperOptions
 * @returns {OpenTelemetryLogData}
 */
 function toOpenTelemetry (sourceObject, { messageKey }, resourceOptions) {
  const { time, level, hostname, pid, trace_id, span_id, trace_flags, [messageKey]: msg, ...attributes } = sourceObject;

  const severityNumber = SEVERITY_NUMBER_MAP[sourceObject.level];
  const severityText = SEVERITY_NAME_MAP[severityNumber];

  return {
    Body: msg,
    Timestamp: time + ZEROS_FROM_MILLI_TO_NANO,
    SeverityNumber: severityNumber,
    SeverityText: severityText,
    TraceId: trace_id,
    SpanId: span_id,
    TraceFlags: trace_flags,
    Resource: {
      ...resourceOptions,
      'host.hostname': hostname,
      'process.pid': pid
    },
    Attributes: attributes
  };
}
