import jsforce from 'jsforce';

import config from 'config';

const logger = require('../core/logger');

function subscribeSalesforceStream(salesforceApi, topicName, messageCallback) {
  if (salesforceApi == null) {
    throw new Error('Requires salesforceApi, a jsForce connection.');
  }

  if (typeof messageCallback !== 'function') {
    throw new Error('Requires messageCallback function to handle each message received.');
  }

  // Handle Salesforce API auth failure by logging and crashing
  const exitCallback = () => {
    logger.error(`!      Salesforce API authentication became invalid. Exiting failure.`)
    process.exit(1);
  };
  const authFailureExt = new jsforce.StreamingExtension.AuthFailure(exitCallback);

  // To debug all messages, add this extension to the createClient arg array
  const loggingExt = new LoggingExtension(logger);

  // Create the Faye streaming client: https://faye.jcoglan.com/
  const fayeClient = salesforceApi.streaming.createClient([ authFailureExt, loggingExt ]);
  const redisClient = global.datasources[(config as any).caching].client;

  // Subscribe to each topic including support for checkpoint persistence
  logger.info(`-----> Subscribing to Salesforce topic ${topicName}`);

  const replayKey = `replayId:${topicName}`;
  function saveReplayId(v) {
    return new Promise((resolve, reject) => {
      if (v != null) {
        redisClient.set(replayKey, v.toString(), (err, res) => {
          if (err) {
            reject(err);
          } else {
            logger.debug(`       ⏺  Save checkpoint ${v}`);
            resolve(res);
          }
        });
      } else {
        resolve(null);
      }
    });
  }
  function readReplayId() {
    return new Promise((resolve, reject) => {
      redisClient.get(replayKey, (err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
  }

  return readReplayId().then( v => {
    const replayId = v == null ? null : parseInt(v, 10);
    return subscribeAndPush(
      salesforceApi,
      fayeClient,
      topicName,
      replayId,
      saveReplayId,
      messageCallback,
      logger);
  })
}

function subscribeAndPush(
  salesforceApi,
  fayeClient,
  topicName,
  replayId,
  saveReplayId,
  messageCallback,
  logger
) {
  if (replayId != null) {
    logger.info(`       ⏮  Replaying from ${replayId}`);
    const replayExt = new jsforce.StreamingExtension.Replay(topicName, replayId);
    fayeClient.addExtension(replayExt);
  }
  logger.info(`       ▶️  Now streaming…`);
  fayeClient.subscribe(topicName, data => {
    // Call user-supplied function with the data and Salesforce API
    return Promise.resolve()
      .then(() => messageCallback(data, salesforceApi))
      .then(() => saveReplayId(data.event.replayId))
      .catch( err => {
        logger.error(`!      Streaming subscription error: ${err.stack}`);
      });
  });
}

/**
 * Log all incoming CometD messages
 */
const LoggingExtension = function(logger) {
  this.incoming = function(message, callback) {
    logger.debug(`       👁‍🗨 message from Salesforce ${JSON.stringify(message)}`);
    callback(message);
  }
};

export default subscribeSalesforceStream;
