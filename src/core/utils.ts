import { PlainObject } from "./common";
import { logger } from './logger';
import { GSStatus } from './interfaces'; // eslint-disable-line
import { dirname } from  'path';

import CoffeeScript from 'coffeescript';
import config from "config";

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
  logger.debug('workflowJson: %o',workflowJson);

  for (let task of workflowJson.tasks) {
      if (task.tasks) {
          logger.debug('checking nested tasks');
          const status:GSStatus = checkDatasource(task,datasources);
      } else {
          if (task.args?.datasource) {
              if (!(task.args.datasource in datasources) && !task.args.datasource.match(/<(.*?)%.+%>/)) {
                //The datasource is neither present in listed datasources and nor is a dynamically evaluated expression, then it is an error
                logger.error('datasource %s is not present in datasources', task.args.datasource);
                const msg = `datasource ${task.args.datasource} is not present in datasources`;
                return new GSStatus(false,500,msg);
              }
          }
        }
  }
  return new GSStatus(true,undefined);
}

export function prepareScript(str: string): Function {

  //@ts-ignore
  let lang = config.lang || 'coffee';

  let langs = (/<(.*?)%/).exec(str);

  //@ts-ignore
  lang = langs[1] ||  config.lang || 'coffee';

  str = str.trim();
  if (str.match(/^<(.*?)%/) && str.match(/%>$/)) {
    let temp = str.replace(/^<(.*?)%/, '').replace(/%>$/, '');
    if (!temp.includes('%>')) {
      str = temp;
    }
  }

  if (str.match(/<(.*?)%/) && str.match(/%>/)) {
    str = "'" + str.replace(/<(.*?)%/g, "' + ").replace(/%>/g, " + '") + "'";
  }

  logger.debug('lang: %s', lang);
  logger.debug('script: %s', str);

  str = str.trim();

  if (!/\breturn\b/.test(str)) {
    str = 'return ' + str;
  }

  if (lang === 'coffee') {
    str = CoffeeScript.compile(str ,{bare: true});
  }

  return Function('config', 'inputs', 'outputs', 'mappings', str);
}

export function compileScript(args: any) {
  if (typeof(args) == 'object') {
    if (!Array.isArray(args)) {
      let out: PlainObject = {};

      for (let k in args) {
        out[k] = compileScript(args[k]);
      }

      return function(config:any, inputs:any, outputs:any, mappings: any) {
        for (let k in out) {
          out[k] = out[k](config, inputs, outputs, mappings);
        }
        return out;
      };
    } else {
        let out:[any] = <any>[];
        for (let k in args) {
          out[k] = compileScript(args[k]);
        }

      return function(config:any, inputs:any, outputs:any, mappings: any) {
        for (let k in out) {
          out[k] = out[k](config, inputs, outputs, mappings);
        }
        return out;
      };
    }
  } else if (typeof(args) == 'string') {
    logger.debug('before replacing path params %s', args);
    args = args.replace(/(^|\/):([^/]+)/g, '$1<%inputs.params.$2%>');
    logger.debug('after replacing path params %s', args);

    if (args.match(/<(.*?)%/) && args.includes('%>')) {
      return prepareScript(args);
    }
  }

  return () => args;
}

export function checkFunctionExists(events: PlainObject, functions: PlainObject): GSStatus {
  for (let event in events) {
    if (! (events[event].fn in functions)) {
      logger.error('function %s of event %s is not present in functions', events[event].fn, event);
      const msg = `function ${events[event].fn} of event ${event} is not present in functions`;
      return new GSStatus(false,500,msg);
    }
  }
  return new GSStatus(true, undefined);
}

export function removeNulls (obj: PlainObject) {
  const isArray = Array.isArray(obj);
  for (const k of Object.keys(obj)) {
    if (obj[k] === null) {
      if (isArray) {
        //@ts-ignore
        obj.splice(k, 1);
      } else {
        delete obj[k];
      }
    } else if (typeof obj[k] === "object") {
      removeNulls(obj[k]);
    }
    //@ts-ignore
    if (isArray && obj.length === k) {
      removeNulls(obj);
    }
  }
  return obj;
}