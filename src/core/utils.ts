import { PlainObject } from "./common";
import { logger } from './logger';
import { GSStatus } from './interfaces';
const { dirname } = require('path');
//@ts-ignore
export const PROJECT_ROOT_DIRECTORY = dirname(require.main.filename);

//like Lodash _.get method
export function getAtPath(obj: PlainObject, path: string) {
  const keys = path.split('.');
  for (const key of keys) {
    if (key in obj) { //obj[key]
      obj = obj[key];
    } else {
      return undefined;
    }
  }
  return obj;
}

//like Lodash _.set method
export function setAtPath(o: PlainObject, path: string, value: any) {
  const keys = path.split('.');
  let obj = o;
  //prepare the array to ensure that there is nested PlainObject till the last key
  //Ensure there is an PlainObject as value till the second last key
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (key in obj) { //obj[key]
      obj = obj[key];
    } else {
      obj = (obj[key] = {});
    }
  }
  const lastKey = keys[keys.length - 1];
  obj[lastKey] = value;
}

export function checkDatasource(workflowJson: PlainObject, datasources: PlainObject): GSStatus {
  logger.debug('checkDatasource');
  logger.debug('workflowJson: %o', workflowJson);

  for (let task of workflowJson.tasks) {
    if (task.tasks) {
      logger.debug('checking nested tasks');
      const status: GSStatus = checkDatasource(task, datasources);
    } else {
      if (task.args?.datasource) {
        if (!(task.args.datasource in datasources)) {
          logger.error('datasource %s is not present in datasources', task.args.datasource);
          const msg = `datasource ${task.args.datasource} is not present in datasources`;
          return new GSStatus(false, 500, msg);
        }
      }
    }
  }
  return new GSStatus(true, undefined);
}
