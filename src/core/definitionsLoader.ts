import loadYaml from './yamlLoader';
import ajvInstance from './validation';
import { logger } from '../logger';

const loadAndRegisterDefinitions = async (pathString: string) => {
  logger.info('Loading definitions...');
  const definitions = await loadYaml(pathString, false);
  logger.debug('Definitions: %o', definitions);
  ajvInstance.addSchema({
    $id: 'https://godspeed.systems/definitions.json',
    definitions,
  });
  logger.info('Definitions loaded and registered to ajvInstance');
};

export { loadAndRegisterDefinitions };
