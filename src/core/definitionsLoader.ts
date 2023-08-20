import loadYaml from './yamlLoader';
import ajvInstance from './validation';
import { logger } from '../logger';

const loadAndRegisterDefinitions = async (pathString: string) => {
  const definitions = loadYaml(pathString, false);
  logger.debug('Definitions: %o', definitions);
  ajvInstance.addSchema({
    $id: 'https://godspeed.systems/definitions.json',
    definitions,
  });
  logger.debug('Definitions loaded and registered to ajvInstance');
  return definitions;
};

export { loadAndRegisterDefinitions };
