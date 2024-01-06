/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import _ from 'lodash';
import parseDuration from 'parse-duration';
import opentelemetry from "@opentelemetry/api";

import { CHANNEL_TYPE, ACTOR_TYPE, EVENT_TYPE, PlainObject } from './common';
import { logger } from '../logger';
import { compileScript, isPlainObject, setAtPath } from './utils';
import evaluateScript from './scriptRuntime';
import promClient from '@godspeedsystems/metrics';
import config from 'config';
import pino from 'pino';

const tracer = opentelemetry.trace.getTracer(
  'my-service-tracer'
);

export class GSFunction extends Function {
  yaml: PlainObject;

  id: string; // can be dot separated fqn

  args?: any;

  args_script?: Function;

  fn?: Function;

  onError?: PlainObject;

  retry?: PlainObject;

  isSubWorkflow?: boolean;

  logs?: PlainObject;

  metrics?: [PlainObject];

  workflow_name?: string;

  workflows: PlainObject;

  nativeFunctions: PlainObject;

  fnScript?: Function;

  caching?: Function;

  constructor(yaml: PlainObject, workflows: PlainObject, nativeFunctions: PlainObject, _fn?: Function, args?: any, isSubWorkflow?: boolean, fnScript?: Function) {
    super('return arguments.callee._observability.apply(arguments.callee, arguments)');
    this.yaml = yaml;
    this.id = yaml.id || yaml.workflow_name;
    this.fn = _fn;
    this.workflow_name = yaml.workflow_name;
    this.workflows = workflows;
    this.nativeFunctions = nativeFunctions;
    this.fnScript = fnScript;


    this.args = args || {};
    const str = JSON.stringify(this.args);

    if ((str.match(/<(.*?)%/) && str.includes('%>')) || str.match(/(^|\/):([^/]+)/)) {
      this.args_script = compileScript(this.args);
    }


    this.onError = yaml.on_error;

    if (this.onError && this.onError.response) {
      if (!(this.onError.response instanceof Function)) {
        this.onError!.response = compileScript(this.onError.response);
      }
    }

    // if (this.yaml.authz) {
    //   this.yaml.authz.args = compileScript(this.yaml.authz?.args);
    // }

    // retry
    this.retry = yaml.retry;
    if (this.retry) {
      if (this.retry.interval) {
        this.retry.interval = parseDuration(this.retry.interval.replace(/^PT/i, ''));
      }
      if (this.retry.min_interval) {
        this.retry.min_interval = parseDuration(this.retry.min_interval.replace(/^PT/i, ''));
      }
      if (this.retry.max_interval) {
        this.retry.max_interval = parseDuration(this.retry.max_interval.replace(/^PT/i, ''));
      }
    }

    this.isSubWorkflow = isSubWorkflow;

    if (this.yaml.logs) {
      this.logs = this.yaml.logs;
      if (this.logs?.before) {
        if (!(this.logs.before.attributes instanceof Function)) {
          this.logs.before.attributes.task_id = this.id;
          this.logs.before.attributes.workflow_name = this.workflow_name;
          this.logs.before.attributes = compileScript(this.logs.before.attributes);
        }
      }
      if (this.logs?.after) {
        if (!(this.logs.after.attributes instanceof Function)) {
          this.logs.after.attributes.task_id = this.id;
          this.logs.after.attributes.workflow_name = this.workflow_name;
          this.logs.after.attributes = compileScript(this.logs.after.attributes);
        }
      }
    }

    // metrics
    if (this.yaml.metrics) {
      this.metrics = this.yaml.metrics;
      // @ts-ignore
      for (let metric of this.metrics) {
        metric.labels.task_id = this.id;
        metric.labels.workflow_name = this.workflow_name;
        switch (metric.type) {
          case 'counter':
            metric.obj = new promClient.Counter({
              name: metric.name,
              help: metric.help,
              labelNames: Object.keys(metric.labels || {})
            });
            break;

          case 'gauge':
            metric.obj = new promClient.Gauge({
              name: metric.name,
              help: metric.help,
              labelNames: Object.keys(metric.labels || {})
            });
            break;

          case 'histogram':
            metric.obj = new promClient.Histogram({
              name: metric.name,
              help: metric.help,
              labelNames: Object.keys(metric.labels || {})
            });
            break;

          case 'summary':
            metric.obj = new promClient.Summary({
              name: metric.name,
              help: metric.help,
              labelNames: Object.keys(metric.labels || {})
            });
            break;

          default:
            logger.error({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'Invalid metric type %s, it should be one of counter,summary,histogram,gauge', metric.type);
            process.exit(1);
        }

        for (let key of Object.keys(metric)) {
          if (!['type', 'name', 'obj', 'timer', 'help'].includes(key)) {
            metric[key] = compileScript(metric[key]);
          }
        }
      }
    }

    //caching
    if (this.yaml.caching) {
      this.caching = compileScript(this.yaml.caching);
    }
  }

  async _internalCall(ctx: GSContext, taskValue: any): Promise<GSStatus> {
    if (this.logs?.before) {
      const log = this.logs.before;
      //@ts-ignore
      ctx.childLogger[log.level](log.attributes ? await evaluateScript(ctx, log.attributes, taskValue) : null, `${log.message} %o`, log.params);
    }

    const timers = [];
    if (this.metrics) {
      for (let metric of this.metrics) {
        if (metric.timer) {
          //@ts-ignore
          timers.push(metric.obj.startTimer());
        }
      }
    }

    const status = await this._call(ctx, taskValue);

    if (this.metrics) {
      for (let timer of timers) {
        //@ts-ignore
        timer();
      }

      for (let metric of this.metrics) {
        let obj = metric.obj;
        for (let key of Object.keys(metric)) {
          if (!['type', 'name', 'obj', 'timer', 'help'].includes(key)) {
            const val = await evaluateScript(ctx, metric[key], taskValue);
            obj = obj[key](val);
          }
        }
      }
    }

    if (this.logs?.after) {
      const log = this.logs.after;
      //@ts-ignore
      ctx.childLogger[log.level](log.attributes ? await evaluateScript(ctx, log.attributes, taskValue) : null, `${log.message} %o`, log.params);
    }

    return status;
  }

  async _observability(ctx: GSContext, taskValue: any): Promise<GSStatus> {

    if (this.yaml.trace) {
      let trace = this.yaml.trace;

      return tracer.startActiveSpan(trace.name, async span => {
        if (trace.attributes) {
          trace.attributes.task_id = this.id;
          trace.attributes.workflow_name = this.workflow_name;
          for (let attr in trace.attributes) {
            span.setAttribute(attr, trace.attributes[attr]);
          }
        }
        const status = await this._internalCall(ctx, taskValue);

        if (!status.success) {
          span.setStatus({
            //@ts-ignore
            code: opentelemetry.SpanStatusCode.ERROR,
            message: 'Error'
          });
        }
        span.end();

        return status;
      });

    } else {
      return this._internalCall(ctx, taskValue);
    }
  }

  async _executefn(ctx: GSContext, taskValue: any): Promise<GSStatus> {
    // final status to return
    let status: GSStatus;
    let args = this.args;
    try {
      ctx.childLogger.info({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'Executing handler %s %o', this.id, this.args);
      if (Array.isArray(this.args)) {
        args = [...this.args];
      } else if (isPlainObject(this.args)) {
        args = { ...this.args };
      }

      ctx.childLogger.debug({ 'workflow_name': this.workflow_name, 'task_id': this.id }, `Retry logic is %o`, this.retry);
      ctx.childLogger.setBindings({ 'workflow_name': this.workflow_name, 'task_id': this.id });
      if (String(this.yaml.fn).startsWith('datasource.')) {
        // If datasource is a script then evaluate it else load ctx.datasources as it is.
        const [, datasourceName, entityType, method] = this.yaml.fn.split('.');
        const datasource: any = ctx.datasources[datasourceName];

        // so that prisma plugin get the entityName and method in plugin to execute respective method.
        args.meta = {
          fnNameInWorkflow: this.yaml.fn,
          entityType,
          method,
        };

        // REMOVE: this is not required, because now all the datasources are functions

        // if (datasource instanceof Function) {
        //   args.datasource = await evaluateScript(ctx, datasource, taskValue);
        //   ctx.childLogger.info({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'datasource evaluated');
        // } else {
        //   args.datasource = datasource;
        //   ctx.childLogger.info({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'datasource %o', args.datasource);
        // }



        // copy datasource headers to args.config.headers [This is useful to define the headers at datasource level
        // so that datasource headers are passed to all the workflows using this datasource]
        let headers = datasource.config.headers;
        if (headers) {
          args.headers = args.headers || {};
          let tempObj: any = {};
          Object.keys({ ...headers, ...args.headers }).map(key => {
            tempObj[key] = args.headers[key] || headers[key];
          });
          Object.assign(args.headers, tempObj);
          Object.keys(args.headers).forEach(key => args.headers[key] === undefined && delete args.headers[key]);
          ctx.childLogger.info({ 'workflow_name': this.workflow_name, 'task_id': this.id }, `settings datasource headers: %o`, args.headers);
        }

        // TODO: this will be moved to datasource plugin
        // if (ds.authn && !datasource.authn_response) {
        //   ctx.childLogger.info({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'Executing datasource authn workflow');
        //   datasource.authn_response = await authnWorkflow(ds, ctx);
        // }

        // TODO: this will be moved to datasource plugin
        // if (ds.before_method_hook) {
        //   await ds.before_method_hook(ctx);
        // }
      }

      // TODO: look back
      // if (args && ctx.inputs.metadata?.messagebus?.kafka) {  //com.gs.kafka will always have args
      //   args.kafka = ctx.inputs.metadata?.messagebus.kafka;
      // }

      // Generally all methods with retry will have some args
      if (args && this.retry) {
        args.retry = this.retry;
      }

      let res;

      ctx.childLogger.setBindings({ 'workflow_name': this.workflow_name, 'task_id': this.id });
      if (Array.isArray(args)) {
        res = await this.fn!(ctx, args);
      } else {
        res = await this.fn!(ctx, args);
      }

      ctx.childLogger.info({ 'workflow_name': this.workflow_name, 'task_id': this.id }, `Result of _executeFn ${this.id} %o`, res);

      if (res instanceof GSStatus) {
        status = res;
      } else {
        if (typeof (res) == 'object' && (res.success !== undefined || res.code !== undefined)) {
          //Some framework functions like HTTP return an object in following format. Check if that is the case.
          //All framework functions are expected to set success as boolean variable. Can not be null.
          let { success, code, data, message, headers, exitWithStatus } = res;
          status = new GSStatus(success, code, message, data, headers);

          //Check if exitWithStatus is set in the res object. If it is set then return by setting ctx.exitWithStatus else continue.
          if (exitWithStatus) {
            ctx.exitWithStatus = status;
          }
        } else {
          //This function gives a non GSStatus compliant return, then create a new GSStatus and set in the output for this function
          status = new GSStatus(
            true,
            200, //Default code be 200 for now
            undefined,
            res
            //message: skip
            //code: skip
          );
        }
      }
    } catch (err: any) {
      ctx.childLogger.error({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'Caught error from execution in task id: %s, error: %s', this.id, err);
      status = new GSStatus(
        false,
        500,
        err.message,
        `Caught error from execution in task id: ${this.id}, error: ${err}`
      );
    }

    // TODO: move it to datasource
    // if (args.datasource?.after_method_hook) {
    //   ctx.outputs.current_output = status;
    //   await args.datasource.after_method_hook(ctx);
    // }
    return status;
  }

  async handleError(ctx: GSContext, status: GSStatus, taskValue: any): Promise<GSStatus> {

    if (!status.success) {
      /**
      * If the call had an error, set that in events so that we can send it to the telemetry backend.
      */
      ctx.addLogEvent(new GSLogEvent('ERROR', ctx.outputs));

      if (this.onError) {
        ctx.outputs[this.id] = status;
        if (this.onError.response instanceof Function) {
          //The script may need the output of the task so far, for the transformation logic.
          //So set the status in outputs, against this task's id
          const res = await evaluateScript(ctx, this.onError.response, taskValue);
          if (typeof res === 'object' && !(res.success === undefined && res.code === undefined)) { //Meaning the script is returning GS Status compatible response
            let { success, code, data, message, headers } = res;
            status = new GSStatus(success, code, message, data, headers);
          } else {
            //This function gives a non GSStatus compliant return, then create a new GSStatus and set in the output for this function
            status = new GSStatus(
              true,
              200, //Default code be 200 for now
              undefined,
              res
            );
          }

        } else if (this.onError.response) {
          status.data = this.onError.response;
        } else if (this.onError.tasks) {
          status = await this.onError.tasks(ctx);
        }

        if (this.onError.log_attributes) {
          const error: PlainObject = {};
          const logAttributes: PlainObject = this.onError.log_attributes;

          for (let key in logAttributes) {
            const script = compileScript(logAttributes[key]);
            error[key] = await evaluateScript(ctx, script, taskValue);
          }
          ctx.childLogger.setBindings({ error });
        }

        if (this.onError.continue === false) {
          ctx.childLogger.debug({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'exiting on error %s', this.id);
          ctx.exitWithStatus = status;
        }
      } else {
        if (ctx.exitWithStatus) {
          ctx.exitWithStatus = status;
        }
      }
    }

    ctx.outputs[this.id] = status;

    return status;
  }

  /**
   *
   * @param instruction
   * @param ctx
   */
  async _call(ctx: GSContext, taskValue: any): Promise<GSStatus> {

    let status;
    let caching: PlainObject | null = null;
    let redisClient;
    try {
      ctx.childLogger.debug({ 'workflow_name': this.workflow_name, 'task_id': this.id }, '_call invoked with task value %s %o', this.id, taskValue);
      let datastoreAuthzArgs;/*
      This is when datasource needs to modify its SQL query or something
      else to ensure that the current user gets or mutates only the data
      which it has access to.
    */

      if (this.yaml.authz) {
        ctx.childLogger.setBindings({ 'workflow_name': this.workflow_name, 'task_id': this.id });

        ctx.childLogger.debug( `Invoking authz workflow`);
        //let args = await evaluateScript(ctx, this.yaml.authz.args, taskValue);
        ctx.forAuth = true;
        //const newCtx = ctx.cloneWithNewData(args);
        ctx.forAuth = true;
        let authzRes: GSStatus = await this.yaml.authz(ctx);
        ctx.forAuth = false;
        if (authzRes.code === 403) { 
          //Authorization task executed successfully and returned user is not authorized
          authzRes.success = false;
          if (!authzRes.data?.message) {
            setAtPath(authzRes, 'data.message', authzRes.message || 'Access Forbidden');
          }
          ctx.exitWithStatus = authzRes;
          ctx.childLogger.debug('Authorization task failed at the task level with code 403');

          //This task has failed and task must not be allowed to execute further
          return authzRes;
        } else if(authzRes.success !== true) {
          //Ensure success = false for no ambiguity further
          authzRes.success =  false;
          authzRes.code = authzRes.code || 403;
          if (!authzRes.data?.message) {
            setAtPath(authzRes, 'data.message', authzRes.message || 'Access Forbidden');
          }
          ctx.childLogger.debug(`Task level auth failed. Authorization task did not explicitly return success === true, hence failed with code ${authzRes.code}`);
          ctx.exitWithStatus = authzRes;
          return authzRes;
        }
        ctx.childLogger.debug('Authorization passed at the task level');

        //Authorization successful. 
        //Whatever is in the data of the authzRes is to be passed on to
        //the datasource plugin's execute function as it is.
        datastoreAuthzArgs = authzRes.data;
      }
      ctx.childLogger.setBindings({ 'workflow_name': this.workflow_name, 'task_id': this.id });

      if (this.caching) {
        caching = await evaluateScript(ctx, this.caching, taskValue);

        // @ts-ignore
        redisClient = global.datasources[(config as any).caching].client;
        if (caching?.invalidate) {
          ctx.childLogger.info({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'invalidating cache for %s', caching?.invalidate);
          await redisClient.del(caching.invalidate);
        }

        if (!caching?.force) {
          // check in cache and return
          status = await redisClient.get(caching?.key);
          if (status) {
            ctx.childLogger.info({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'reading result from cache');
            status = JSON.parse(status);
            ctx.outputs[this.id] = status;
            return status;
          }
        }
      }

      let args = this.args;
      if (this.args_script) {
        args = await evaluateScript(ctx, this.args_script, taskValue);
        if (args == 'Error in parsing script') {
          throw ctx.exitWithStatus;
        }
      }
      ctx.childLogger.info({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'args after evaluation: %s %o', this.id, args);

      if (datastoreAuthzArgs && this.yaml.fn?.startsWith("datasource.")) {
        //args.data = _.merge(args.data, datastoreAuthzArgs);
        args.authzData = datastoreAuthzArgs;
        ctx.childLogger.info({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'merged args with authz args.data: %o', args);
      }

      ctx.childLogger.setBindings({ 'workflow_name': '', 'task_id': '' });
      if (this.fnScript) {
        ctx.childLogger.setBindings({ 'workflow_name': this.workflow_name, 'task_id': this.id });
        let s: string = await evaluateScript(ctx, this.fnScript, taskValue);
        ctx.childLogger.setBindings({ 'workflow_name': '', 'task_id': '' });
        this.fn = this.nativeFunctions?.[s];

        if (!this.fn) {
          this.fn = this.workflows?.[s];
          this.isSubWorkflow = true;
        }

        ctx.childLogger.info({ 'workflow_name': this.workflow_name, 'task_id': this.id }, `invoking dynamic fn: ${s}`);
      }

      if (this.fn instanceof GSFunction) {
        if (this.isSubWorkflow) {
          ctx.childLogger.info({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'isSubWorkflow, creating new ctx');

          ctx.childLogger.setBindings({ 'workflow_name': this.workflow_name, 'task_id': this.id });
          const newCtx = ctx.cloneWithNewData(args);
          ctx.childLogger.setBindings({ 'workflow_name': '', 'task_id': '' });
          status = await this.fn(newCtx, taskValue);
        } else {
          ctx.childLogger.info({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'No isSubWorkflow, continuing in the same ctx');
          status = await this.fn(ctx, taskValue);
        }
      }
      else {
        this.args = args;
        status = await this._executefn(ctx, taskValue);
      }
    } catch (err: any) {
      ctx.childLogger.error({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'Caught error in evaluation in task id: %s, error: %o', this.id, err);
      status = new GSStatus(
        false,
        500,
        err.message,
        `Caught error from execution in task id ${this.id}`
      );
    }

    status = await this.handleError(ctx, status, taskValue);
    if (caching && caching.key) {
      if (status?.success || caching.cache_on_failure) {
        ctx.childLogger.info({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'Store result in cache');
        await redisClient.set(caching.key, JSON.stringify(status), { EX: caching.expires });
      }
    }

    return status;
  };
}

export class GSSeriesFunction extends GSFunction {

  override async _call(ctx: GSContext, taskValue: any): Promise<GSStatus> {
    ctx.childLogger.info({ 'workflow_name': this.workflow_name, 'task_id': this.id }, `GSSeriesFunction. Executing tasks with ids: ${this.args.map((task: any) => task.id)}`);
    let ret;

    for (const child of this.args!) {
      ret = await child(ctx, taskValue);
      if (ctx.exitWithStatus) {
        if (child.yaml.isEachParallel) {
          ctx.childLogger.debug({ 'workflow_name': this.workflow_name,'task_id': this.id }, 'isEachParallel: %s, ret: %o', child.yaml.isEachParallel, ret);
          ctx.outputs[this.id] = ret;
          return ret;
        }
        if (child.yaml.isParallel) {
          ctx.childLogger.debug({ 'workflow_name': this.workflow_name,'task_id': this.id }, 'isParallel: %s, ret: %o', child.yaml.isParallel, ret);
          ctx.outputs[this.id] = ret;
          console.log("this is from the parallel condition")
        }
        else {
          ctx.outputs[this.id] = ret;
          return ret;
        }
        
       }
    }
    ctx.childLogger.setBindings({ 'workflow_name': this.workflow_name, 'task_id': this.id });
    ctx.childLogger.debug({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'this.id: %s, output: %o', this.id, ret.data);
    ctx.outputs[this.id] = ret;
    return ret;
  }
}

export class GSDynamicFunction extends GSFunction {

  override async _call(ctx: GSContext, taskValue: any): Promise<GSStatus> {
    ctx.childLogger.debug({ 'workflow_name': this.workflow_name, 'task_id': this.id }, `GSDynamicFunction. Executing tasks with ids: ${this.args.map((task: any) => task.id)}`);
    let ret;

    for (const child of this.args!) {
      ret = await child(ctx, taskValue);
      if (ctx.exitWithStatus) {
        ctx.outputs[this.id] = ctx.exitWithStatus;
        return ctx.exitWithStatus;
      }
    }
    ctx.childLogger.debug({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'this.id: %s, output: %s', this.id, ret.data);

    if (ret.success && typeof (ret.data) === 'string') {
      ctx.outputs[this.id] = await this.workflows![ret.data](ctx, taskValue);
    } else {
      return this.handleError(ctx, ret, taskValue);
    }
    return ctx.outputs[this.id];
  }
}

export class GSParallelFunction extends GSFunction {

  override async _call(ctx: GSContext, taskValue: any): Promise<GSStatus> {
    ctx.childLogger.debug({ 'workflow_name': this.workflow_name, 'task_id': this.id }, `GSParallelFunction. Executing tasks with ids: ${this.args.map((task: any) => task.id)}`);

    const promises = [];

    for (const child of this.args!) {
      promises.push(child(ctx, taskValue));
    }

    await Promise.all(promises);

    const outputs: any[] = [];
    const status = new GSStatus(true, 200, '', outputs);
    let output;

    for (const child of this.args!) {

      output = ctx.outputs[child.id];
      outputs.push(output);
    }

    ctx.outputs[this.id] = status;
    return status;
  }
}


export class GSSwitchFunction extends GSFunction {
  condition_script?: Function;

  constructor(yaml: PlainObject, workflows: PlainObject, nativeFunctions: PlainObject, _fn?: Function, args?: any, isSubWorkflow?: boolean) {
    super(yaml, workflows, nativeFunctions, _fn, args, isSubWorkflow);
    const [condition, cases] = this.args!;
    if (typeof (condition) == 'string' && condition.match(/<(.*?)%/) && condition.includes('%>')) {
      this.condition_script = compileScript(condition);
    }
  }

  override async _call(ctx: GSContext, taskValue: any): Promise<GSStatus> {
    ctx.childLogger.info({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'GSSwitchFunction');
    ctx.childLogger.debug({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'inside switch executor: %o', this.args);
    // tasks incase of series, parallel and condition, cases should be converted to args
    let [value, cases] = this.args!;
    ctx.childLogger.debug({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'condition: %s', value);
    if (this.condition_script) {
      ctx.childLogger.setBindings({ 'workflow_name': this.workflow_name, 'task_id': this.id });
      value = await evaluateScript(ctx, this.condition_script, taskValue);
      ctx.childLogger.setBindings({ 'workflow_name': '', 'task_id': '' });
    }
    if (cases[value]) {
      await cases[value](ctx, taskValue);
      ctx.outputs[this.id] = ctx.outputs[cases[value].id];
    } else {
      //check for default otherwise error
      if (cases.default) {
        await cases.default(ctx, taskValue);
        ctx.outputs[this.id] = ctx.outputs[cases.default.id];
      } else {
        //error
        ctx.outputs[this.id] = new GSStatus(false, undefined, `case ${value} is missing and no default found in switch`);
      }
    }

    return ctx.outputs[this.id];
  }
}

export class GSIFFunction extends GSFunction {
  condition_script?: Function;

  task?: GSFunction;

  else_fn?: GSFunction;

  constructor(yaml: PlainObject, workflows: PlainObject, nativeFunctions: PlainObject, _fn?: Function, args?: any, isSubWorkflow?: boolean) {
    super(yaml, workflows, nativeFunctions, _fn, args, isSubWorkflow);
    const [condition, task, else_fn] = this.args!;
    if (typeof (condition) == 'string' && condition.match(/<(.*?)%/) && condition.includes('%>')) {
      this.condition_script = compileScript(condition);
    }

    this.task = task;
    this.else_fn = else_fn;
  }

  override async _call(ctx: GSContext, taskValue: any): Promise<GSStatus> {
    ctx.childLogger.info({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'GSIFFunction');
    ctx.childLogger.debug({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'inside GSIFFunction executor: %o', this.args);
    // tasks incase of series, parallel and condition, cases should be converted to args
    let [value, task] = this.args!;
    ctx.childLogger.debug({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'condition: %s', value);
    if (this.condition_script) {
      ctx.childLogger.setBindings({ 'workflow_name': this.workflow_name, 'task_id': this.id });
      value = await evaluateScript(ctx, this.condition_script, taskValue);
      ctx.childLogger.setBindings({ 'workflow_name': '', 'task_id': '' });
    }

    if (value) {
      ctx.outputs[this.id] = await this.task!(ctx, taskValue);
    } else {
      if (this.else_fn) {
        ctx.outputs[this.id] = await this.else_fn(ctx, taskValue);
      } else {
        ctx.outputs[this.id] = new GSStatus(false, undefined, `condition not matching and no else present`);
      }
    }

    return ctx.outputs[this.id];
  }
}

export class GSEachParallelFunction extends GSFunction {
  value_script?: Function;

  constructor(yaml: PlainObject, workflows: PlainObject, nativeFunctions: PlainObject, _fn?: Function, args?: any, isSubWorkflow?: boolean) {
    super(yaml, workflows, nativeFunctions, _fn, args, isSubWorkflow,);
    const [value, cases] = this.args!;
    if (typeof (value) == 'string' && value.match(/<(.*?)%/) && value.includes('%>')) {
      this.value_script = compileScript(value);
    }
  }

  override async _call(ctx: GSContext, taskValue: any): Promise<GSStatus> {
    ctx.childLogger.debug({ 'workflow_name': this.workflow_name, 'task_id': this.id }, `GSEachParallelFunction. Executing tasks with ids: ${this.args.map((task: any) => task.id)}`);

    let [value, task] = this.args!;
    ctx.childLogger.debug({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'value: %o', value);
    if (this.value_script) {
      ctx.childLogger.setBindings({ 'workflow_name': this.workflow_name, 'task_id': this.id });
      value = await evaluateScript(ctx, this.value_script, taskValue);
      ctx.childLogger.setBindings({ 'workflow_name': '', 'task_id': '' });
    }

    let i = 0;
    if (!Array.isArray(value)) {
      ctx.outputs[this.id] = new GSStatus(false, undefined, `GSEachParallel value is not an array`);
      return ctx.outputs[this.id];
    }

    const promises = [];
    let outputs: any[] = [];
    let status: GSStatus;
    let failedTasksCount = 0;

    for (const val of value) {
      promises.push(task(ctx, val));
    }
    outputs = await Promise.all(promises);
    status = new GSStatus(true, 200, '', outputs);

    for (const output of outputs) {
      if (!output.success) {
        failedTasksCount++;
      }
    }

    delete ctx.exitWithStatus;
    ctx.outputs[this.id] = status;

    // if the all the tasks get failed then check on_error at each_parallel loop level
    if (failedTasksCount == value.length && value.length > 0) {
      status.success = false;
      status.code = 500;
      return this.handleError(ctx, status, taskValue);
    }

    return status;
  }
}

export class GSEachSeriesFunction extends GSFunction {
  value_script?: Function;

  constructor(yaml: PlainObject, workflows: PlainObject, nativeFunctions: PlainObject, _fn?: Function, args?: any, isSubWorkflow?: boolean) {
    super(yaml, workflows, nativeFunctions, _fn, args, isSubWorkflow);
    const [value, cases] = this.args!;
    if (typeof (value) == 'string' && value.match(/<(.*?)%/) && value.includes('%>')) {
      this.value_script = compileScript(value);
    }
  }

  override async _call(ctx: GSContext, taskValue: any): Promise<GSStatus> {
    let [value, task] = this.args!;
    ctx.childLogger.debug({ 'workflow_name': this.workflow_name, 'task_id': this.id }, 'value: %o', value);
    if (this.value_script) {
      ctx.childLogger.setBindings({ 'workflow_name': this.workflow_name, 'task_id': this.id });
      value = await evaluateScript(ctx, this.value_script, taskValue);
      ctx.childLogger.setBindings({ 'workflow_name': '', 'task_id': '' });
    }

    if (!Array.isArray(value)) {
      ctx.outputs[this.id] = new GSStatus(false, undefined, `GsEachSeries is value is not an array`);
      return ctx.outputs[this.id];
    }

    ctx.childLogger.debug({ 'workflow_name': this.workflow_name, 'task_id': this.id }, `GSEachSeriesFunction. Executing tasks with ids: ${this.args.map((task: any) => task.id)}`);

    const outputs: any[] = [];
    const status = new GSStatus(true, 200, '', outputs);
    let taskRes: any;
    let failedTasksCount = 0;

    for (const val of value) {
      taskRes = await task(ctx, val);

      if (!taskRes.success) {
        failedTasksCount++;
      }

      if (ctx.exitWithStatus) {
        ctx.outputs[this.id] = ctx.exitWithStatus;
        outputs.push(ctx.outputs[this.id]);
        break;  // break from for loop when continue is false for any task_value in each_sequential.
      }
      outputs.push(taskRes);
    }

    delete ctx.exitWithStatus; // exitWithStatus is removed from ctx so that other tasks (outside each_sequential loop) can be continued.
    ctx.outputs[this.id] = status;

    // if the all the tasks get failed then check on_error at each_sequential loop level
    if (failedTasksCount == value.length && value.length > 0) {
      status.success = false;
      status.code = 500;
      return this.handleError(ctx, status, taskValue);
    }

    return ctx.outputs[this.id];
  }
}

/**
 * Final outcome of GSFunction execution.
 */
export class GSStatus {
  success: boolean;

  code?: number;

  message?: string;

  data?: any;

  headers?: { [key: string]: any; };

  exitWithStatus?: boolean;

  constructor(success: boolean = true, code?: number, message?: string, data?: any, headers?: { [key: string]: any; }) {
    this.message = message;
    this.code = code;
    this.success = success;
    this.headers = headers;
    this.data = data;
  }
}

export class GSCloudEvent {
  //Cloud event format common fields
  id: string; //This should be the request id of distributed context

  time: Date;

  specversion: string;

  type: string; //URI of this event

  source: string;

  channel: CHANNEL_TYPE;

  actor: GSActor;

  //JSON schema: This data will be validated in the function definition in YAML. In __args.schema
  data: PlainObject; //{body, params, query, headers}, flattened and merged into a single object

  metadata?: {
    telemetry?: object //all the otel info captured in the incoming event headers/metadata
  };

  constructor(id: string, type: string, time: Date, source: string, specversion: string, data: object, channel: CHANNEL_TYPE, actor: GSActor, metadata: any) {
    this.id = id;
    this.type = type;
    this.channel = channel;
    this.actor = actor;
    this.time = time;
    this.metadata = metadata;
    this.source = source;
    this.data = data;
    this.specversion = specversion;
  }

  public cloneWithNewData(data: PlainObject): GSCloudEvent {
    return new GSCloudEvent(
      this.id,
      this.type,
      this.time,
      this.source,
      this.specversion,
      _.cloneDeep(data),
      this.channel,
      this.actor,
      this.metadata
    );
  }
}
/**
 * __actor (alias to __event.actor), __vars, __config, __src, __modules, __env, __event, __res (starting from the first parent span), __args (of the running GS instruction)
 */
export class GSContext { //span executions
  inputs: GSCloudEvent; //The very original event for which this workflow context was created

  outputs: { [key: string]: GSStatus; }; //DAG result. This context has a trace history and responses of all instructions in the DAG are stored in this object

  log_events: GSLogEvent[] = [];

  config: PlainObject; //app config

  datasources: PlainObject; //app config

  mappings: any;

  plugins: PlainObject;

  exitWithStatus?: GSStatus;

  logger: pino.Logger;

  childLogger: pino.Logger;

  forAuth?: boolean = false;

  constructor(config: PlainObject, datasources: PlainObject, event: GSCloudEvent, mappings: any, plugins: PlainObject, logger: pino.Logger, childLogger: pino.Logger) {//_function?: GSFunction
    this.inputs = event;
    this.config = config;
    this.outputs = {};
    this.datasources = datasources;
    this.mappings = mappings;
    this.plugins = plugins;
    this.logger = logger;
    this.childLogger = childLogger;

    childLogger.debug('inputs for context %o', event.data);
  }

  public cloneWithNewData(data: PlainObject): GSContext {
    return new GSContext(
      this.config,
      this.datasources,
      this.inputs?.cloneWithNewData(data),
      this.mappings,
      this.plugins,
      this.logger,
      this.childLogger
    );
  }

  public addLogEvent(event: GSLogEvent): void {
    this.log_events?.push(event);
    //also push to the logging backend
  }
}

/**
 *
 * Basic event information.this
 */
export class GSLogEvent {
  type: EVENT_TYPE;

  data: any;

  timestamp: Date;

  attributes: object;

  constructor(type: EVENT_TYPE, data: any, attributes: object = {}, timestamp: Date = new Date()) {
    this.type = type;
    this.data = data;
    this.attributes = attributes;
    this.timestamp = timestamp;
  }
}

export class GSActor {
  type: ACTOR_TYPE;

  tenant_id?: string;

  name?: string; // Fully qualified name

  id?: string; // id of the actor

  data?: PlainObject; //Other information in key value pairs. For example IP address

  constructor(type: ACTOR_TYPE, tenant_id?: string, name?: string, id?: string, data?: PlainObject) {
    this.type = type;
    this.tenant_id = tenant_id;
    this.name = name;
    this.id = id;
    this.data = data;
  }
}

/**
 *
 * Final ResponseStructure
 */
export interface GSResponse {
  apiVersion?: string;
  context?: string;
  id?: string;
  method?: string;
  data?: {
    kind?: string;
    fields?: string;
    etag?: string;
    id?: string;
    lang?: string;
    updated?: string;
    deleted?: boolean;
    currentItemCount?: number;
    itemsPerPage?: number;
    startIndex?: number;
    totalItems?: number;
    pageIndex?: number;
    totalPages?: number;
    pageLinkTemplate?: number;
    next?: PlainObject;
    nextLink?: string;
    previous?: PlainObject;
    previousLink?: string;
    self?: PlainObject;
    selfLink?: string;
    edit?: PlainObject;
    editLink?: string;
    items?: PlainObject[];
  };
  error?: {
    code?: number;
    message?: string;
    errors?: {
      domain?: string;
      reason?: string;
      message?: string;
      location?: string;
      locationType?: string;
      extendedHelp?: string;
      sendReport?: string;
    }[];
  };

  
}