import iterate_yaml_directories from './configLoader';
import { PlainObject } from './common';
import { logger } from './logger';

let config: PlainObject = {};

(function loadSources() {
  config.app = iterate_yaml_directories(__dirname + '/..')['..'];
  logger.info('Loaded yaml configuration');
  //logger.debug(config.app, 'config.app');
})();

export { config };
