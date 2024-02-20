/*
 * You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
 * © 2022 Mindgrep Technologies Pvt Ltd
 */
import glob from 'glob';
import yaml from 'yaml';
import path from 'path';

import { readFileSync } from 'fs';

import { PlainObject } from './common';
import { logger } from '../logger';
import { P } from 'pino';

export default function loadYaml(
  pathString: string,
  global: boolean = false
): PlainObject {
  let basePath = path.basename(pathString);
  let api: PlainObject = {};
  const yamlFilesLocation = path.join(pathString, '**', '*.?(yaml|yml)').replace(/\\/g, '/');
  let files;
  try {
    files = glob.sync(yamlFilesLocation);
  } catch (err) {
    logger.fatal('Error in reading YAML files from dir %s %o', yamlFilesLocation, err);
    process.exit(1);
  }
  
  files.map((file: string) => {
    try {
      module = yaml.parse(readFileSync(file, { encoding: 'utf-8' }));
    } catch (err) {
      logger.fatal('Error in parsing YAML file %s %o', file, err);
      process.exit(1);
    }

    const id = file
      .replace(new RegExp(`.*?\/${basePath}\/`), '')
      .replace(/\//g, '.')
      .replace(/\.(yaml|yml)/i, '')
      .replace(/\.index$/, '');
    if (global) {
      api = {
        ...api,
        ...module,
      };
    } else {
      if (id == 'index') {
        api = module;
      } else {
        api[id] = module;
      }
    }
  });

  return api;
}

if (require.main === module) {
  (async () => {
    try {
      await loadYaml('../../dist/events', true).then(console.log);
    } catch (ex) {
      logger.error('Caught exception %o', (ex as Error).stack);
    }
  })();
}
