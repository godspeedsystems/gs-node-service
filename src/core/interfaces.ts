import { randomUUID } from 'crypto';
import _ from 'lodash';
import parseDuration from 'parse-duration';
import opentelemetry from "@opentelemetry/api";

import { CHANNEL_TYPE, ACTOR_TYPE, EVENT_TYPE, PlainObject } from './common';
import { logger } from './logger';
import { compileScript } from './utils';  // eslint-disable-line
import evaluateScript from '../scriptRuntime'; // eslint-disable-line
import { promClient } from './telemetry/monitoring';

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

  log?: PlainObject;

  metrics?: [PlainObject];

  constructor(yaml: PlainObject, _fn?: Function, args?: any, isSubWorkflow?: boolean) {
    super('return arguments.callee._tracer.apply(arguments.callee, arguments)');
    this.yaml = yaml;
    this.id = yaml.id || randomUUID();
    this.fn = _fn;

    if (args) {
      this.args = args;
      const str = JSON.stringify(args);

      if (_fn && (str.match(/<(.*?)%/) && str.includes('%>')) || str.match(/(^|\/):([^/]+)/)) {
        this.args_script = compileScript(args);
      }
    }

    this.onError = yaml.onError;

    if (this.onError && this.onError.response) {
      const response = JSON.stringify(this.onError.response);
      if (response.match(/<(.*?)%/) && response.includes('%>')) {
        this.onError!.response = compileScript(response);
      }
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

    if (this.yaml.log) {
      this.log = this.yaml.log;

      if (this.log?.before) {
        this.log.before.args = compileScript(this.log.before.args);
      }

      if (this.log?.after) {
        this.log.after.args = compileScript(this.log.after.args);
      }
    }

    if (this.yaml.metrics) {
      this.metrics = this.yaml.metrics;
      // @ts-ignore
      for (let metric of this.metrics) {
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
              logger.error('Invalid metric type %s, it should be one of counter,summary,histogram,gauge', metric.type);
              process.exit(1);
        }

        for (let key of Object.keys(metric)) {
          if (!['type', 'name', 'obj','timer'].includes(key)) {
            metric[key] = compileScript(metric[key]);
          }
        }
      }
    }
  }

  async _internalCall(ctx: GSContext): Promise<GSStatus> {
    if (this.yaml.log?.before) {
      const log = this.yaml.log.before;
      logger[log.level](log.args ? evaluateScript(ctx, log.args): null, log.message);
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

    const status = await this._call(ctx);

    if (this.metrics) {
      for(let timer of timers) {
        //@ts-ignore
        timer();
      }

      for (let metric of this.metrics) {
        let obj = metric.obj;
        for (let key of Object.keys(metric)) {
          if (!['type', 'name', 'obj', 'timer'].includes(key)) {
            const val = evaluateScript(ctx, metric[key]);
            obj = obj[key](val);
          }
        }
      }
    }

    if (this.yaml.log?.after) {
      const log = this.yaml.log.after;
      logger[log.level](log.args ? evaluateScript(ctx, log.args): null, log.message);
    }

    return status;
  }

  async _observability(ctx: GSContext): Promise<GSStatus> {

    if (this.yaml.trace) {
      let trace = this.yaml.trace;

      return tracer.startActiveSpan(trace.name, async span => {
        if (trace.attributes) {
          for (let attr in trace.attributes) {
            span.setAttribute(attr, trace.attributes[attr]);
          }
        }
        const status = await this._internalCall(ctx);

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
      return this._internalCall(ctx);
    }
  }

  async _executefn(ctx: GSContext):Promise<GSStatus> {
    let status: GSStatus; //Final status to return
    try {
      logger.debug('Executing handler %s %o', this.id, this.args);
      let args;
      if (this.args_script) {
        args = await evaluateScript(ctx, this.args_script);
      } else {
        args = _.cloneDeep(this.args);
      }

      logger.debug(`args after evaluation: ${this.id} ${JSON.stringify(args)}. Retry logic is ${this.retry}`);
      if (args?.datasource) {
        // If datasource is a script then evaluate it else load ctx.datasources as it is.
        const datasource: any = ctx.datasources[args.datasource];
        if (datasource instanceof Function) {
          args.datasource = await evaluateScript(ctx, datasource);
        } else {
          args.datasource = datasource;
        }

        logger.info('datasource %o', args.datasource);

        // copy datasource headers to args.config.headers [This is useful to define the headers at datasource level
        // so that datasource headers are passed to all the workflows using this datasource]
        let headers = args.datasource.headers;
        if (headers) {
          args.config.headers = args.config.headers || {};
          Object.assign(args.config.headers, headers);
          logger.debug(`settings datasource headers: %o`, args.config.headers);
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
        res = await this.fn?.apply(null, args);
      } else {
        res = await this.fn!(args);
      }

      logger.info(`Result of _executeFn ${this.id} is ${typeof res === 'string' ? res: JSON.stringify(res)}`);


      if (res instanceof GSStatus) {
        status = res;
      } else {
        if (typeof(res) == 'object' && (res.success !== undefined || res.code !== undefined)) {
          //Some framework functions like HTTP return an object in following format. Check if that is the case.
          //All framework functions are expected to set success as boolean variable. Can not be null.
          let {success, code, data, message, headers} = res;
          status = new GSStatus(success, code, message, data, headers);
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
      logger.error('Caught error from execution in task id: %s, error: %o',this.id, err);
      status = new GSStatus(
          false,
          500,
          err.message,
          `Caught error from execution in task id ${this.id}`
        );
    }

    return this.handleError(ctx, status); //In acvse there is error, this.on_error will be considered for further action
  }

  async handleError (ctx: GSContext, status: GSStatus): Promise<GSStatus> {
    //Default value of success is true, if left undefined. //TODO add to the docs.
    if (this.onError && status.success === false) {

      if (this.onError.response instanceof Function ) {
        //The script may need the output of the task so far, for the transformation logic.
        //So set the status in outputs, against this task's id
        ctx.outputs[this.id] = status;
        const res = await evaluateScript(ctx, this.onError.response);
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
        ctx.outputs[this.id] = status;
        status = await this.onError.tasks(ctx);
      }

      if (this.onError.continue === false) {
        ctx.exitWithStatus = status;
      }
    }
    return status;
  }

  /**
   *
   * @param instruction
   * @param ctx
   */
  async _call(ctx: GSContext): Promise<GSStatus> {

    if (this.fn instanceof GSFunction) {
      if (this.isSubWorkflow) {
        logger.info('isSubWorkflow, creating new ctx');
        let args = this.args;
        if (this.args_script) {
          args = await evaluateScript(ctx, this.args_script);
        }
        const newCtx = ctx.cloneWithNewData(args);
        await this.fn(newCtx);
        ctx.outputs[this.id] = newCtx.outputs[this.fn.id];
      } else {
        logger.info('No isSubWorkflow, continuing in the same ctx');
        await this.fn(ctx);
      }
    }
    else {
      //logger.info('invoking inner function');
      //logger.debug(ctx.inputs, 'inputs');
      ctx.outputs[this.id] = await this._executefn(ctx);
    }
    /**
     * If the call had an error, set that in events so that we can send it to the telemetry backend.
     */
    if (!ctx.outputs[this.id].success) {
      ctx.addLogEvent(new GSLogEvent('ERROR', ctx.outputs));
    }

    return ctx.outputs[this.id];
  };
}

export class GSSeriesFunction extends GSFunction {

  override async _call(ctx: GSContext): Promise<GSStatus> {
    logger.debug(`GSSeriesFunction. Executing tasks with ids: ${this.args.map((task: any) => task.id)}`);
    let finalId;

    for (const child of this.args!) {
      //logger.debug(child);  //Not displaying the object --> Need to check
      await child(ctx);
      finalId = child.id;
      if (ctx.exitWithStatus) {
        ctx.outputs[this.id] = ctx.exitWithStatus;
        return ctx.exitWithStatus;
      }

      logger.debug('finalID: %s',finalId);
    }
    logger.debug('this.id: %s, finalId: %s', this.id, finalId);
    ctx.outputs[this.id] = ctx.outputs[finalId];
    return ctx.outputs[this.id];
  }
}

export class GSParallelFunction extends GSFunction {

  override async _call(ctx: GSContext): Promise<GSStatus> {
    logger.debug(`GSParallelFunction. Executing tasks with ids: ${this.args.map((task: any) => task.id)}`);

    const promises = [];

    for (const child of this.args!) {
      promises.push(child(ctx));
    }

    await Promise.all(promises);

    const outputs:any[] = [];
    const status = new GSStatus(true, 200, '', outputs);
    let output;

    for (const child of this.args!) {
      output = ctx.outputs[child.id];
      // populating only first failed task status and code
      if (!output.success && status.success) {
        status.success = false;
        status.code = output.code;
        status.message = output.message;
      }

      outputs.push(output);
    }

    ctx.outputs[this.id] = status;
    return status;
  }
}

export class GSSwitchFunction extends GSFunction {
  condition_script?: Function;

  constructor(yaml: PlainObject, _fn?: Function, args?: any, isSubWorkflow?: boolean) {
    super(yaml, _fn, args, isSubWorkflow);
    const [condition, cases] = this.args!;
    if (condition.match(/<(.*?)%/) && condition.includes('%>')) {
      this.condition_script = compileScript(condition);
    }
  }

  override async _call(ctx: GSContext): Promise<GSStatus> {
    logger.info('GSSwitchFunction');
    logger.debug('inside switch executor: %o',this.args);
    //logger.debug(ctx,'ctx')
    // tasks incase of series, parallel and condition, cases should be converted to args
    let [value, cases] = this.args!;
    logger.debug('condition: %s' , value);
    if (this.condition_script) {
      value = await evaluateScript(ctx, this.condition_script);
    }
    if (cases[value]) {
      await cases[value](ctx);
      ctx.outputs[this.id] = ctx.outputs[cases[value].id];
    } else {
      //check for default otherwise error
      if (cases.default) {
        await cases.default(ctx);
        ctx.outputs[this.id] = ctx.outputs[cases.default.id];
      } else{
        //error
        ctx.outputs[this.id] = new GSStatus(false, undefined, `case ${value} is missing and no default found in switch`);
      }
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

    logger.debug('inputs for context %s', JSON.stringify(event.data));
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
