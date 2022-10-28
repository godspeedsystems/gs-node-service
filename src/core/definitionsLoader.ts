import { logger } from './logger';
import loadYaml from './yamlLoader';

const loadDefinitions = async (pathString: string) => {
  const definitions = await loadYaml(pathString, false);
  logger.debug('Definitions loaded: %o', definitions);
  return definitions;
};

export { loadDefinitions };
