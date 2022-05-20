import { PlainObject } from "./common";
import { logger } from './logger';
import { GSStatus } from './interfaces';
import config from 'config';

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
  logger.debug('checkDatasource')
  logger.debug('workflowJson: %o', workflowJson)

  for (let task of workflowJson.tasks) {
    if (task.tasks) {
      logger.debug('checking nested tasks')
      const status: GSStatus = checkDatasource(task, datasources);
    } else {
      if (task.args?.datasource) {
        if (!(task.args.datasource in datasources)) {
          logger.error('datasource %s is not present in datasources', task.args.datasource)
          const msg = `datasource ${task.args.datasource} is not present in datasources`
          return new GSStatus(false, 500, msg);
        }
      }
    }
  }
  return new GSStatus(true, undefined);
}

export function expandVariable(value: string) {
  try {
    if ((value as string).includes('<%')) {
      console.log("value before:", value)
      logger.debug('value before %s', value)

      value = (value as string).replace(/"?<%\s*(.*?)\s*%>"?/, '$1');
      //TODO: pass other context variables
      console.log("config:;;", config)
      value = Function('config', 'return ' + value)(config);
      console.log("after value:", value)
      logger.debug('value after %s', value)
    }
  } catch (ex) {
    //console.error(ex);
    logger.error(ex);
  }
  return value;
}
