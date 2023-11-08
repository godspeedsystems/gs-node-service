/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import iterate_yaml_directories from './configLoader';
import { PlainObject } from './common';
import { logger } from '../logger';

let config: PlainObject = {};

(function loadSources() {
  config.app = iterate_yaml_directories(__dirname + '/..')['..'];
  logger.info('Loaded yaml configuration');
})();

export { config };
