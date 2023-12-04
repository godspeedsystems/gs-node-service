/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import * as fs from 'fs';
import * as process from 'process';
import * as yaml from 'js-yaml';

import { logger } from "../logger";

function iterate_yaml_directories(current_yaml_root:any) {
  var recursive_object_state:any = {};
  // list down all directories and iterate back on child directories
  var files = fs.readdirSync(current_yaml_root);
  files = files.sort(function (a, b) {
    return b.split('.').length - a.split('.').length;
  });

  //To determine the yaml property for which the current iteration is for
  const paths_split_array = current_yaml_root.split('/');
  const current_property = paths_split_array[paths_split_array.length - 1];

  if (!recursive_object_state.hasOwnProperty(current_property))
    recursive_object_state[current_property] = {};

  for (const file of files) {
    let temp_obj:any;
    if (file.endsWith('.yaml') || file.endsWith('.yml') || file.endsWith('.json')) {
      try {
        temp_obj = yaml.load(
          fs.readFileSync(current_yaml_root + '/' + file, { encoding: 'utf-8' })
        );
      } catch (error) {
        logger.error(`Error while loading ${file}: ${error}`);
        process.exit(1);
      }

      if (temp_obj) {
        const temp_obj_keys = Object.keys(temp_obj);
        for (var key in temp_obj_keys) {
          key = temp_obj_keys[key];

          if (file == 'index.yaml' || file == 'index.yml' || file == 'index.json') {
            recursive_object_state[current_property][key] = temp_obj[key];
          } else {
            const file_name = file.slice(0,-5);
            if (!recursive_object_state[current_property].hasOwnProperty(file_name)){
              recursive_object_state[current_property][file_name] = {};
            }

            recursive_object_state[current_property][file_name][key] = temp_obj[key];
          }
        }
      }
    } else if (!file.endsWith('.yaml')) {
      if (file.includes('.') || current_yaml_root.includes('node_modules')) continue;
      const next_yaml_root = current_yaml_root + '/' + file;
      const intermediate_object_state = iterate_yaml_directories(
        next_yaml_root
      );

      const intermediate_object_state_keys = Object.keys(intermediate_object_state);
      for (var key in intermediate_object_state_keys) {
        key = intermediate_object_state_keys[key];

        if (!recursive_object_state[current_property].hasOwnProperty(key))
          recursive_object_state[current_property][key] = {};

        recursive_object_state[current_property][key] = intermediate_object_state[key];
      }
    }
  }
  return recursive_object_state;
};

export default iterate_yaml_directories;

if (require.main === module) {
  var relative_config_root = process.argv.slice(2)[0];
  var nested_yaml_result = iterate_yaml_directories(relative_config_root);
  logger.info('yaml object %o',nested_yaml_result); 
  logger.info('object as string %s',JSON.stringify(nested_yaml_result, null, 2));
} 