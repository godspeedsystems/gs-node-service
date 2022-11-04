import { logger } from './logger';
import loadYaml from './yamlLoader';
import ajvInstance from './validation';

const loadAndRegisterDefinitions = async (pathString: string) => {
  logger.debug('Loading definitions...');
  const definitions = await loadYaml(pathString, false);
  logger.debug('Definitions: %o', definitions);
  ajvInstance.addSchema({
    $id: 'https://godspeed.systems/definitions.json',
    definitions,
  });
  logger.debug('Definitions loaded and registered to ajvInstance');
};

export { loadAndRegisterDefinitions };
