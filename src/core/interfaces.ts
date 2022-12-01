/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { randomUUID } from 'crypto';
import _ from 'lodash';
import parseDuration from 'parse-duration';
import opentelemetry from "@opentelemetry/api";

import { CHANNEL_TYPE, ACTOR_TYPE, EVENT_TYPE, PlainObject } from './common';
import { logger } from './logger';
import { compileScript, isPlainObject } from './utils';  // eslint-disable-line
import evaluateScript from '../scriptRuntime'; // eslint-disable-line
import { promClient } from '../telemetry/monitoring';
import authnWorkflow from './authnWorkflow';

const tracer = opentelemetry.trace.getTracer(
  'my-service-tracer'
);

//import R from 'ramda';
/**
  * SPEC:
  * Lender's integration:
  * YAML workflow spec
  * project scaffolding
  * API schema spec (includes channel integration)
  * runtime interfaces
  *
  * DEV:
  * dev: runtime engine (execute workflow and includes adapters for different channels)
  * dev: telemetry
  * dev: special functions:
  *  http
  *  transformation
  *
  * Parallel:
  *   GS_data
  */


/**
 * About hooks:
 *
 * LOG EVENT HANDLING (including error)
 * OPTION A:
 *  Whether error happens or not, it can return multiple GSEvents of type: error, warning,
 *  debug, info. On error, the called Function MUST itself handle error internally.
 *  These events will be logged by the common code. If there is an event with error,
 *  the common code will straightaway jump to the finally block.
 * OPTION B:
 *  Dev logs all events himself within the function. And if there is an error,
 *  return GSError (preferred), or throw the error for default handling.
 *  On catching an error, the common code will straightaway jump to the finally block.
 *
 *
 *  NO RETURN (Or any return will be ignored)
 *  If a hook needs subsequent hooks or _function to read any data calculated by it,
 *  it must set that data as per the expected key in ctx.{private | shared}, for the subsequent
 *  logic to consume it. If it returns anything, it will be ignored and not passed to subsequent hooks.
 *
 */

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

  workflows?: PlainObject;

  constructor(yaml: PlainObject, _fn?: Function, args?: any, isSubWorkflow?: boolean, workflows?: PlainObject) {
    super('return arguments.callee._observability.apply(arguments.callee, arguments)');
    this.yaml = yaml;
    this.id = yaml.id || randomUUID();
    this.fn = _fn;
    this.workflow_name = yaml.workflow_name;
    this.workflows = workflows;

    if (args) {
      this.args = args;
      const str = JSON.stringify(args);

      if (_fn && (str.match(/<(.*?)%/) && str.includes('%>')) || str.match(/(^|\/):([^/]+)/)) {
        this.args_script = compileScript(args);
      }
    }

    this.onError = yaml.on_error;

    if (this.onError && this.onError.response) {
      this.onError!.response = compileScript(this.onError.response);
    }

    if (this.yaml.authz?.args) {
      this.yaml.authz.args = compileScript(this.yaml.authz?.args);
    }

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
        this.logs.before.attributes.task_id = this.id;
        this.logs.before.attributes.workflow_name = this.workflow_name;
        this.logs.before.attributes = compileScript(this.logs.before.attributes);
      }

      if (this.logs?.after) {
        this.logs.after.attributes.task_id = this.id;
        this.logs.after.attributes.workflow_name = this.workflow_name;
        this.logs.after.attributes = compileScript(this.logs.after.attributes);
      }
    }

    if (this.yaml.metrics) {
      this.metrics = this.yaml.metrics;
      // @ts-ignore
      for (let metric of this.metrics) {
        metric.labels.task_id = this.id;
        metric.labels.workflow_name = this.workflow_name;
        switch(metric.type) {
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
              logger.error({'task_id': this.id, 'workflow_name': this.workflow_name}, 'Invalid metric type %s, it should be one of counter,summary,histogram,gauge', metric.type);
              process.exit(1);
        }

        for (let key of Object.keys(metric)) {
          if (!['type', 'name', 'obj','timer', 'help'].includes(key)) {
            metric[key] = compileScript(metric[key]);
          }
        }
      }
    }
  }

  async _internalCall(ctx: GSContext, taskValue:any): Promise<GSStatus> {
    if (this.logs?.before) {
      const log = this.logs.before;
      //@ts-ignore
      logger[log.level](log.attributes ? await evaluateScript(ctx, log.attributes, taskValue): null, `${log.message} %o`, log.params);
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
      for(let timer of timers) {
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
      logger[log.level](log.attributes ? await evaluateScript(ctx, log.attributes, taskValue): null, `${log.message} %o`, log.params);
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

  async _executefn(ctx: GSContext, taskValue: any):Promise<GSStatus> {
    let status: GSStatus; //Final status to return
    try {
      logger.debug({'task_id': this.id, 'workflow_name': this.workflow_name}, 'Executing handler %s %o', this.id, this.args);
      let args;
      args = _.cloneDeep(this.args);

      logger.debug({'task_id': this.id, 'workflow_name': this.workflow_name}, `Retry logic is ${this.retry}`);
      if (args?.datasource) {
        // If datasource is a script then evaluate it else load ctx.datasources as it is.
        const datasource: any = ctx.datasources[args.datasource];
        if (datasource instanceof Function) {
          args.datasource = await evaluateScript(ctx, datasource, taskValue);
          logger.info({'task_id': this.id, 'workflow_name': this.workflow_name}, 'datasource evaluated');
        } else {
          args.datasource = datasource;
          logger.info({'task_id': this.id, 'workflow_name': this.workflow_name}, 'datasource %o', args.datasource);
        }

        let ds = args.datasource;

        // copy datasource headers to args.config.headers [This is useful to define the headers at datasource level
        // so that datasource headers are passed to all the workflows using this datasource]
        let headers = ds.headers;
        if (headers) {
          args.config.headers = args.config.headers || {};
          Object.assign(args.config.headers, headers);
          logger.debug({'task_id': this.id, 'workflow_name': this.workflow_name}, `settings datasource headers: %o`, args.config.headers);
        }

        if (ds.authn && !datasource.authn_response) {
          logger.info({'task_id': this.id, 'workflow_name': this.workflow_name}, 'Executing datasource authn workflow');
          datasource.authn_response = await authnWorkflow(ds, ctx);
        }
      }

      if (args && ctx.inputs.metadata?.messagebus?.kafka) {  //com.gs.kafka will always have args
        args.kafka = ctx.inputs.metadata?.messagebus.kafka;
      }

      if (args && this.retry) { //Generally all methods with retry will have some args
        args.retry = this.retry;
      }

      let res;

      if (Array.isArray(args)) {
        res = await this.fn?.apply(null, args.concat({logger, promClient, tracer}));
      } else {
        res = await this.fn!(args, {logger, promClient, tracer});
      }

      logger.info({'task_id': this.id, 'workflow_name': this.workflow_name}, `Result of _executeFn ${this.id} %o`, res);


      if (res instanceof GSStatus) {
        status = res;
      } else {
        if (typeof(res) == 'object' && (res.success !== undefined || res.code !== undefined)) {
          //Some framework functions like HTTP return an object in following format. Check if that is the case.
          //All framework functions are expected to set success as boolean variable. Can not be null.
          let {success, code, data, message, headers, exitWithStatus} = res;
          status = new GSStatus(success, code, message, data, headers);

          //Check if exitWithStatus is set in the res object. If it is set then return by setting ctx.exitWithStatus else continue.
          if (exitWithStatus) {
            ctx.exitWithStatus = status;
            return status;
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
      logger.error({'task_id': this.id, 'workflow_name': this.workflow_name}, 'Caught error from execution in task id: %s, error: %s',this.id, err);
      status = new GSStatus(
          false,
          500,
          err.message,
          `Caught error from execution in task id ${this.id}`
        );
    }

    return status;
  }

  async handleError (ctx: GSContext, status: GSStatus, taskValue: any): Promise<GSStatus> {

    if (!status.success) {
      /**
      * If the call had an error, set that in events so that we can send it to the telemetry backend.
      */
      ctx.addLogEvent(new GSLogEvent('ERROR', ctx.outputs));

      if (this.onError) {
        ctx.outputs[this.id] = status;
        if (this.onError.response instanceof Function ) {
          //The script may need the output of the task so far, for the transformation logic.
          //So set the status in outputs, against this task's id
          const res = await evaluateScript(ctx, this.onError.response, taskValue);
          if (typeof res === 'object' && !(res.success === undefined && res.code === undefined)) { //Meaning the script is returning GS Status compatible response
            let {success, code, data, message, headers} = res;
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

        if (this.onError.continue === false) {
          logger.debug({'task_id': this.id, 'workflow_name': this.workflow_name}, 'exiting on error %s', this.id);
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

    logger.info({'task_id': this.id, 'workflow_name': this.workflow_name}, '_call invoked with task value %s %o', this.id, taskValue);
    let status, prismaArgs;

    if (this.yaml.authz) {
      logger.info({'task_id': this.id, 'workflow_name': this.workflow_name}, 'invoking authz workflow, creating new ctx');
      let args = await evaluateScript(ctx, this.yaml.authz.args, taskValue);

      const newCtx = ctx.cloneWithNewData(args);
      let allow = await this.yaml.authz(newCtx, taskValue);
      if (allow.success) {
        if (allow.data === false) {
          ctx.exitWithStatus = new GSStatus(false, 403,  allow.message || 'Unauthorized');
          return ctx.exitWithStatus;
        } else if (isPlainObject(allow.data)) {
          prismaArgs = allow.data;
        }
      }
    }

    let args = this.args;
    if (this.args_script) {
      args = await evaluateScript(ctx, this.args_script, taskValue);
    }
    logger.debug({'task_id': this.id, 'workflow_name': this.workflow_name}, `args after evaluation: ${this.id} ${JSON.stringify(args)}`);

    if (prismaArgs) {
      args.data = _.merge(args.data, prismaArgs);
      logger.debug({'task_id': this.id, 'workflow_name': this.workflow_name}, `merged args with authz args.data: ${JSON.stringify(args)}`);
    }

    if (this.fn instanceof GSFunction) {
      if (this.isSubWorkflow) {
        logger.info({'task_id': this.id, 'workflow_name': this.workflow_name}, 'isSubWorkflow, creating new ctx');

        const newCtx = ctx.cloneWithNewData(args);
        status = await this.fn(newCtx, taskValue);
      } else {
        logger.info({'task_id': this.id, 'workflow_name': this.workflow_name}, 'No isSubWorkflow, continuing in the same ctx');
        status = await this.fn(ctx, taskValue);
      }
    }
    else {
      this.args = _.cloneDeep(args);
      status = await this._executefn(ctx, taskValue);
    }

    return this.handleError(ctx, status, taskValue);
  };
}

export class GSSeriesFunction extends GSFunction {

  override async _call(ctx: GSContext, taskValue: any): Promise<GSStatus> {
    logger.debug({'task_id': this.id, 'workflow_name': this.workflow_name}, `GSSeriesFunction. Executing tasks with ids: ${this.args.map((task: any) => task.id)}`);
    let ret;

    for (const child of this.args!) {
      ret = await child(ctx, taskValue);
      if (ctx.exitWithStatus) {
        if (child.yaml.isEachParallel) {
          logger.debug({'task_id': this.id, 'workflow_name': this.workflow_name}, 'isEachParallel: %s, ret: %o', child.yaml.isEachParallel, ret);
          ctx.outputs[this.id] = ret;
          return ret;
        } else {
          ctx.outputs[this.id] = ctx.exitWithStatus;
          return ctx.exitWithStatus;
        }
      }
    }
    logger.debug({'task_id': this.id, 'workflow_name': this.workflow_name}, 'this.id: %s, output: %o', this.id, ret.data);
    ctx.outputs[this.id] = ret;
    return ret;
  }
}

export class GSDynamicFunction extends GSFunction {

  override async _call(ctx: GSContext, taskValue: any): Promise<GSStatus> {
    logger.debug({'task_id': this.id, 'workflow_name': this.workflow_name}, `GSDynamicFunction. Executing tasks with ids: ${this.args.map((task: any) => task.id)}`);
    let ret;

    for (const child of this.args!) {
      ret = await child(ctx, taskValue);
      if (ctx.exitWithStatus) {
        ctx.outputs[this.id] = ctx.exitWithStatus;
        return ctx.exitWithStatus;
      }
    }
    logger.debug({'task_id': this.id, 'workflow_name': this.workflow_name}, 'this.id: %s, output: %s', this.id, ret.data);

    if (ret.success && typeof(ret.data) === 'string') {
      ctx.outputs[this.id] = await this.workflows![ret.data](ctx, taskValue);
    } else {
      return this.handleError(ctx, ret, taskValue);
    }
    return ctx.outputs[this.id];
  }
}

export class GSParallelFunction extends GSFunction {

  override async _call(ctx: GSContext, taskValue: any): Promise<GSStatus> {
    logger.debug({'task_id': this.id, 'workflow_name': this.workflow_name}, `GSParallelFunction. Executing tasks with ids: ${this.args.map((task: any) => task.id)}`);

    const promises = [];

    for (const child of this.args!) {
      promises.push(child(ctx, taskValue));
    }

    await Promise.all(promises);

    const outputs:any[] = [];
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

  constructor(yaml: PlainObject, _fn?: Function, args?: any, isSubWorkflow?: boolean, workflows?: PlainObject) {
    super(yaml, _fn, args, isSubWorkflow, workflows);
    const [condition, cases] = this.args!;
    if (typeof(condition) == 'string' && condition.match(/<(.*?)%/) && condition.includes('%>')) {
      this.condition_script = compileScript(condition);
    }
  }

  override async _call(ctx: GSContext, taskValue: any): Promise<GSStatus> {
    logger.info({'task_id': this.id, 'workflow_name': this.workflow_name}, 'GSSwitchFunction');
    logger.debug({'task_id': this.id, 'workflow_name': this.workflow_name}, 'inside switch executor: %o',this.args);
    // tasks incase of series, parallel and condition, cases should be converted to args
    let [value, cases] = this.args!;
    logger.debug({'task_id': this.id, 'workflow_name': this.workflow_name}, 'condition: %s' , value);
    if (this.condition_script) {
      value = await evaluateScript(ctx, this.condition_script, taskValue);
    }
    if (cases[value]) {
      await cases[value](ctx, taskValue);
      ctx.outputs[this.id] = ctx.outputs[cases[value].id];
    } else {
      //check for default otherwise error
      if (cases.default) {
        await cases.default(ctx, taskValue);
        ctx.outputs[this.id] = ctx.outputs[cases.default.id];
      } else{
        //error
        ctx.outputs[this.id] = new GSStatus(false, undefined, `case ${value} is missing and no default found in switch`);
      }
    }

    return ctx.outputs[this.id];
  }
}

export class GSEachParallelFunction extends GSFunction {
  value_script?: Function;

  constructor(yaml: PlainObject, _fn?: Function, args?: any, isSubWorkflow?: boolean, workflows?: PlainObject) {
    super(yaml, _fn, args, isSubWorkflow, workflows);
    const [value, cases] = this.args!;
    if (typeof(value) == 'string' && value.match(/<(.*?)%/) && value.includes('%>')) {
      this.value_script = compileScript(value);
    }
  }

  override async _call(ctx: GSContext, taskValue: any): Promise<GSStatus> {
    logger.debug({'task_id': this.id, 'workflow_name': this.workflow_name}, `GSEachParallelFunction. Executing tasks with ids: ${this.args.map((task: any) => task.id)}`);

    let [value, task] = this.args!;
    logger.debug({'task_id': this.id, 'workflow_name': this.workflow_name}, 'value: %o' , value);
    if (this.value_script) {
      value = await evaluateScript(ctx, this.value_script, taskValue);
    }

    let i = 0;
    if (!Array.isArray(value)) {
      ctx.outputs[this.id] = new GSStatus(false, undefined, `GSEachParallel value is not an array`);
      return ctx.outputs[this.id];
    }

    const promises = [];
    let outputs:any[] = [];
    let status: GSStatus;
    let allTasksFailed = true;

    for (const val of value) {
      promises.push(task(ctx, val));
    }
    outputs = await Promise.all(promises);
    status = new GSStatus(true, 200, '', outputs);

    for (const output of outputs) {
      if (output.success) {
        allTasksFailed = false;
      }
    }

    delete ctx.exitWithStatus;
    ctx.outputs[this.id] = status;

    if (allTasksFailed) {
      status.success = false;
      status.code = 500;
      return this.handleError(ctx, status, taskValue); // if the all the tasks get failed then check on_error at each_parallel loop level
    }

    return status;
  }
}

export class GSEachSeriesFunction extends GSFunction {
  value_script?: Function;

  constructor(yaml: PlainObject, _fn?: Function, args?: any, isSubWorkflow?: boolean, workflows?: PlainObject) {
    super(yaml, _fn, args, isSubWorkflow, workflows);
    const [value, cases] = this.args!;
    if (typeof(value) == 'string' && value.match(/<(.*?)%/) && value.includes('%>')) {
      this.value_script = compileScript(value);
    }
  }

  override async _call(ctx: GSContext, taskValue: any): Promise<GSStatus> {
    let [value, task] = this.args!;
    logger.debug({'task_id': this.id, 'workflow_name': this.workflow_name}, 'value: %o' , value);
    if (this.value_script) {
      value = await evaluateScript(ctx, this.value_script, taskValue);
    }

    if (!Array.isArray(value)) {
      ctx.outputs[this.id] = new GSStatus(false, undefined, `GsEachSeries is value is not an array`);
      return ctx.outputs[this.id];
    }

    logger.debug({'task_id': this.id, 'workflow_name': this.workflow_name}, `GSEachSeriesFunction. Executing tasks with ids: ${this.args.map((task: any) => task.id)}`);

    //const outputs:[GSStatus] = <any>[];
    const outputs:any[] = [];
    const status = new GSStatus(true, 200, '', outputs);
    let taskRes: any;
    let allTasksFailed = true;

    for (const val of value) {
      taskRes = await task(ctx, val);

      if (ctx.exitWithStatus) {
        ctx.outputs[this.id] = ctx.exitWithStatus;
        outputs.push(ctx.outputs[this.id]);
        break;  // break from for loop when continue is false for any task_value in each_sequential.
      } else {
        outputs.push(taskRes);
        if (taskRes.success) {
          allTasksFailed = false;
        }
      }
    }

    delete ctx.exitWithStatus; // exitWithStatus is removed from ctx so that other tasks (outside each_sequential loop) can be continued.
    ctx.outputs[this.id] = status;

    if (allTasksFailed) {
      status.success = false;
      status.code = 500;
      return this.handleError(ctx, status, taskValue); // if the all the tasks get failed then check on_error at each_sequential loop level
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

  headers?: {[key:string]: any;};

  constructor(success: boolean = true, code?: number, message?: string, data?: any, headers?: {[key:string]: any;}) {
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
    http?: {
      express: {
        res: object //Express response object
      }
    },
    messagebus: {
      kafka: object
    },
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

  public cloneWithNewData(data:PlainObject): GSCloudEvent {
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

  outputs:{[key: string]: GSStatus; }; //DAG result. This context has a trace history and responses of all instructions in the DAG are stored in this object

  log_events: GSLogEvent[] = [];

  config: PlainObject; //app config

  datasources: PlainObject; //app config

  mappings: any;

  plugins: PlainObject;

  exitWithStatus?: GSStatus;

  constructor(config: PlainObject, datasources: PlainObject, event: GSCloudEvent, mappings: any, plugins: PlainObject) {//_function?: GSFunction
    this.inputs = event;
    this.config = config;
    this.outputs = {};
    this.datasources = datasources;
    this.mappings = mappings;
    this.plugins = plugins;

    logger.debug('inputs for context %o', event.data);
  }

  public cloneWithNewData(data: PlainObject): GSContext {
    return new GSContext(
        this.config,
        this.datasources,
        this.inputs?.cloneWithNewData(data),
        this.mappings,
        this.plugins
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
      sendReport?:string;
    }[];
  };
}

if (require.main === module) {
  // const createSpan = async (ctx: GSContext): Promise<GSContext> => {
  //   console.log('creating span')
  //   return ctx;
  // }
  // const closeSpan = async (ctx: GSContext): Promise<GSContext> => {
  //   //Close the telemetry object span
  //   //Send trace to the tracing backend
  //   console.log('closing span')

  //   return ctx;
  // }
  // const sendLogs = async (ctx: GSContext): Promise<GSContext> => {
  //   console.log('sending events', ctx.events)

  //   return ctx;
  // }

  // //Set pre auths
  // i.preAuthHooks.push(createSpan);
  // i.finally = [closeSpan, sendLogs];

  //i.execute(new GSContext({})).then((ctx) => console.log(JSON.stringify(ctx.outputs))).catch(console.log)
  //sync request : grpc and http
  //async request - response

}

/**
 * Thoughts on telemetry as middleware
 * Baed on telemetry requirements execute (GSFunction, ctx) call must create a span for itself in the ctx object
 * In the finally clause, the microservice or servler should add a hook on all Instruction it wants to trace.
 * Whether to create span for this instruction or not, will be included in the instruction export configuration.
 * Refer: https://docs.mindgrep.com/docs/scaffolding/intro#common-middleware-in-case-of-microservice
 */

/**
 *We have only events. Every http request is also an event.
* Event processor will process the workflow for the event.
* Every event can have multiple workflows attached to them.
* The workflow will execute and create the response.
* Then the adapter will send the response to one or more events on the channels
* specified in the API shema, with the response data & metadata.
 */
