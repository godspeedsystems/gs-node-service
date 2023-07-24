/*
 * You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
 * © 2022 Mindgrep Technologies Pvt Ltd
 */
import { describe, it, expect, path } from './common';
import { fail } from 'assert';
import generateSchema from '../api-specs/api-spec';
import { logger } from '../core/logger';
const projectRootDir = __dirname;
const finalRootDir = projectRootDir.split('/');
finalRootDir.splice(finalRootDir.length - 1, 1);
const eventPath = path.resolve(finalRootDir.join('/') + '/events');
const definitionsPath = path.resolve(finalRootDir.join('/') + '/definitions');
const configPath = path.resolve(finalRootDir.join('/') + '/config');

const testName = path.basename(__filename).split('.')[0];
const fixDir = path.join(__dirname, 'fixtures', testName);

describe(testName, () => {
  it('Checking if a paths key exists in a api-spec', async () => {
    try {
      const result = await generateSchema(eventPath, definitionsPath,configPath);
      logger.debug('result: %o', result);
      expect(result.hasOwnProperty('paths')).to.equal(true);
    } catch (error) {
      logger.error('error: %s', <Error>error);
      fail(<Error>error);
    }
  });
  it('Check if paths is Empty  ', async () => {
    try {
      const result = await generateSchema(eventPath, definitionsPath,configPath);
      logger.debug('result: %o', result);
      expect(Object.keys(result.paths).length === 0).to.equal(false);
    } catch (error) {
      logger.error('error: %s', <Error>error);
      fail(<Error>error);
    }
  });
});
