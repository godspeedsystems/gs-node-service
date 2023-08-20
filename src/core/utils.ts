/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { PlainObject } from "./common";
import { GSStatus } from './interfaces'; // eslint-disable-line
import { dirname } from 'path';

import CoffeeScript from 'coffeescript';
import config from "config";

import * as fs from 'fs';
import * as assert from 'assert';
import * as buffer from 'buffer';
import * as child_process from 'child_process';
import * as cluster from 'cluster';
import * as dgram from 'dgram';
import * as dns from 'dns';
import * as events from 'events';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import * as querystring from 'querystring';
import * as readline from 'readline';
import * as stream from 'stream';
import * as string_decoder from 'string_decoder';
import * as timers from 'timers';
import * as tls from 'tls';
import * as url from 'url';
import * as util from 'util';
import * as zlib from 'zlib';
import { logger } from "../logger";

//@ts-ignore
export const PROJECT_ROOT_DIRECTORY = dirname(require.main.filename);

export const isPlainObject = (value: any) => value?.constructor === Object;

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
      if (task.fn.includes('datasource.')) {
        const dsName = task.fn.split('.')[1];

        if (!(dsName in datasources) && !task.args.datasource.match(/<(.*?)%.+%>/)) {
          //The datasource is neither present in listed datasources and nor is a dynamically evaluated expression, then it is an error
          logger.error('datasource %s is not present in datasources', dsName);
          const msg = `datasource ${dsName} is not present in datasources`;
          return new GSStatus(false, 500, msg);
        }
      }
    }
  }
  return new GSStatus(true, undefined);
}

export function prepareScript(str: string): Function {
  //@ts-ignore
  global.fs = fs;
  //@ts-ignore
  global.assert = assert;
  //@ts-ignore
  global.buffer = buffer;
  //@ts-ignore
  global.child_process = child_process;
  //@ts-ignore
  global.cluster = cluster;
  //@ts-ignore
  global.dgram = dgram;
  //@ts-ignore
  global.dns = dns;
  //@ts-ignore
  global.events = events;
  //@ts-ignore
  global.http = http;
  //@ts-ignore
  global.https = https;
  //@ts-ignore
  global.net = net;
  //@ts-ignore
  global.os = os;
  //@ts-ignore
  global.path = path;
  //@ts-ignore
  global.querystring = querystring;
  //@ts-ignore
  global.readline = readline;
  //@ts-ignore
  global.stream = stream;
  //@ts-ignore
  global.string_decoder = string_decoder;
  //@ts-ignore
  global.timers = timers;
  //@ts-ignore
  global.tls = tls;
  //@ts-ignore
  global.url = url;
  //@ts-ignore
  global.util = util;
  //@ts-ignore
  global.zlib = zlib;


  //@ts-ignore
  let lang = config.lang || 'coffee';

  let langs = (/<(.*?)%/).exec(str);

  //@ts-ignore
  lang = langs[1] || config.lang || 'coffee';

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
  const initialStr = str;

  if (!/\breturn\b/.test(str)) {
    str = 'return ' + str;
  }

  if (lang === 'coffee') {
    str = CoffeeScript.compile(str, { bare: true });
  }

  let prepareScriptFunction: any;
  try {
    prepareScriptFunction = Function('config', 'inputs', 'outputs', 'mappings', 'task_value', str);
  } catch (err: any) {
    logger.error('Caught exception in script compilation, script: %s', initialStr);
    logger.error('exception: %o', err.stack);
    process.exit(1);
  }

  return prepareScriptFunction;
}

export function compileScript(args: any) {
  if (!args) {
    return () => args;
  }

  if (typeof (args) == 'object') {
    if (isPlainObject(args)) {
      let out: PlainObject = {};
      for (let k in args) {
        out[k] = compileScript(args[k]);
      }
      return function (config: any, inputs: any, outputs: any, mappings: any, task_value: any) {
        let returnObj: any = {};
        for (let k in out) {
          if (out[k] instanceof Function) {
            returnObj[k] = out[k](config, inputs, outputs, mappings, task_value);
          }
        }
        return returnObj;
      };
    } else if (Array.isArray(args)) {
      let out: [any] = <any>[];
      for (let k in <[any]>args) {
        out[k] = compileScript(args[k]);
      }
      return function (config: any, inputs: any, outputs: any, mappings: any, task_value: any) {
        let returnObj: any = [];
        for (let k in out) {
          if (out[k] instanceof Function) {
            returnObj.push(out[k](config, inputs, outputs, mappings, task_value));
          } else {
            returnObj.push(out[k]);
          }
        }
        return returnObj;
      };
    } else {
      return () => args;
    }
  } else if (typeof (args) == 'string') {

    if (args.match(/(^|\/):([^/]+)/)) {
      logger.debug('before replacing path params %s', args);
      args = args.replace(/(^|\/):([^/]+)/g, '$1<%inputs.params.$2%>');
      logger.debug('after replacing path params %s', args);
    }

    if (args.match(/<(.*?)%/) && args.includes('%>')) {
      return prepareScript(args);
    }
  }

  return () => args;
}

export function checkFunctionExists(events: PlainObject, functions: PlainObject): GSStatus {
  for (let event in events) {
    if (!(events[event].fn in functions)) {
      logger.error('function %s of event %s is not present in functions', events[event].fn, event);
      const msg = `function ${events[event].fn} of event ${event} is not present in functions`;
      return new GSStatus(false, 500, msg);
    }
  }
  return new GSStatus(true, undefined);
}

export function removeNulls(obj: PlainObject) {
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