/*
 * You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
 * © 2022 Mindgrep Technologies Pvt Ltd
 */

import { logger } from './logger';
import { compileScript } from './utils';
import config from 'config';
import { config as appConfig } from './loader';

export default function loadMappings() {
  logger.info('Loaded mappings: %o', appConfig.app.mappings);

  const mappingScript: Function = compileScript(appConfig.app.mappings);
  const evaluatedMappings = mappingScript(config, {}, {}, appConfig.app.mappings, {});
  logger.info('evaluatedMappings: %o', evaluatedMappings);

  return evaluatedMappings;
}
