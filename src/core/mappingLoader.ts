/*
 * You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
 * © 2022 Mindgrep Technologies Pvt Ltd
 */

import { logger } from './logger';
import loadYaml from './yamlLoader';
import { compileScript } from './utils';
import config from 'config';

export default async function loadMappings(
  pathString: string
) {
  logger.info('Loading mappings');
  const mappings = await loadYaml(pathString, false);
  logger.info('Loaded mappings: %o', mappings);

  const mappingScript: Function = compileScript(mappings);
  const evaluatedMappings = mappingScript(config, {}, {}, mappings, {});
  logger.info('evaluatedMappings: %o', evaluatedMappings);

  return evaluatedMappings;
}
