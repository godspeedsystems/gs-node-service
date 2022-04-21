import { CHANNEL_TYPE, ACTOR_TYPE, EVENT_TYPE } from './common';
import { setAtPath, getAtPath } from './utils';
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
 *  debug, info. On error, the called GSAction MUST itself handle error internally.
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

export type GSAction = GSFunction | Function;
type ExecutionOrder = 'series' | 'parallel' | 'single' | 'if_else';
export class GSFunction {
  id: string; // can be dot separated fqn
  args?: any[];
  summary?: string;
  description?: string;
  functionType: ExecutionOrder = 'single';
  function: GSAction;
  onError?: GSAction;
  constructor(id: string, _function: GSAction, args?: any[], summary?: string, description?: string, functionType: ExecutionOrder = 'single', onError?: GSAction, _finally?: GSAction) {
    this.id = id;
    this.function = _function;
    this.args = args;
    this.functionType = functionType;
    this.summary = summary;
    this.description = description;
    this.onError = onError;
  }
  /**
   * 
   * @param instruction
   * @param ctx
   */
  execute = async (
    ctx: GSContext,
  ): Promise<GSContext> => {
    
    //TODO: Later. Low priority: Execute all hooks one by one, in a reusable code manner
    if (this.function instanceof GSFunction) {
  
      ctx = await (<GSFunction>this.function).execute(ctx);
  
    } else if (typeof this.function === 'function') {
      try {
        let res;
        if (this.functionType === 'series') {
          console.log('inside series', this.args && this.args[0].children)
          res =  await this.function.apply(null, [ctx, this.args && this.args[0].children])
        } else {
          res = await this.function.apply(null, this.args)
        }
        
        if (res instanceof GSStatus) {
          ctx.outputs[this.id] = res; 
        } else {
          //This function gives a non GSStatus comliant return, then create a new GSStatus and set in the output for this function
          ctx.outputs[this.id] = {
            success: true,
            data: res
            //message: skip
            //code: skip
          }
        }
      } catch (err) {
        if (err instanceof Error) {
          //This function threw an error, so it has failed
          ctx.outputs[this.id] = {
            success: false,
            message: err.message,
            data: err.stack
          }
        }
      }
    }
    /**
     * If the call had an error, set that in events so that we can send it to the telemetry backend.
     */
    if (!ctx.outputs[this.id].success) {
      ctx.addLogEvent(new GSLogEvent('ERROR', ctx.outputs));
    }
    return ctx;
  };

}

/**
 * Final outcome of GSFunction execution. 
 */
export class GSStatus {
  success: boolean;
  code?: number;
  message?: string;
  data: any;

  constructor(success: boolean = true, code?: number, message?: string, data?: any) {
    this.message = message;
    this.code = code;
    this.data = data;
    this.success = success;
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
  data: {[key:string]:any;}; //{body, params, query, headers}, flattened and merged into a single object
  metadata?: {
    http?: {
      express: {
        res: object //Express response object
      }
    },
    telemetry?: object //all the otel info captured in the incoming event headers/metadata
  };

  constructor(id: string, type: string, time: Date, source: string, specversion: string, data: object, channel: CHANNEL_TYPE, actor: GSActor, metadata: object) {
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

}
/**
 * __actor (alias to __event.actor), __vars, __config, __src, __modules, __env, __event, __res (starting from the first parent span), __args (of the running GS instruction)
 */
export class GSContext { //span executions
  shared: {[key: string]: any; }; //This data, which can be having query promises, results, entities etc, when updated will get reflected across everyone using same instance of GSContext
  inputs: GSCloudEvent; //The very original event for which this workflow context was created
  outputs:{[key: string]: GSStatus; }; //DAG result. This context has a trace history and responses of all instructions in the DAG are stored in this object
  log_events: GSLogEvent[] = [];
  config: {[key: string]: any; }; //app config
  datasources: {[key: string]: any; }; //app config
  constructor(config: {[key: string]: any; }, datasources: {[key: string]: any; }, shared: {[key: string]: any; } = {}, event: GSCloudEvent) {//_function?: GSFunction
    this.shared = shared;
    this.inputs = event;
    this.config = config;
    this.outputs = {};
    this.datasources = datasources;
  }

  public addLogEvent(event: GSLogEvent): void {
    this.log_events?.push(event);
    //also push to the logging backend
  }
  /**
  * @param {string} key - The key to get data for
  * @return data for given key as found in this.shared or this.vars
  **/
  public get(key: string | object) {
    if (typeof key === 'object' && !Array.isArray(key)) {
      key = JSON.stringify(key);
    }
    const value = getAtPath(this.shared, <string>key);
    return value;
  }
  
  /**
   * Looks for data stored for particular key in this.shared object
   * @param key 
   */
  public getShared(key: string | object) {
    if (typeof key === 'object' && !Array.isArray(key)) {
      key = JSON.stringify(key)
    }
    return getAtPath(this.shared, <string>key);
  }
 
  /**
  * @param {any} key - If an object, it is strigified as JSON. Else used as it is.
  * @param {any} value - The value to be stored against the key
  **/
  public setShared(key: object | string, value: any) {
    if (typeof key === 'object' && !Array.isArray(key)) {
      key = JSON.stringify(key)
    }
    this.shared[<string>key] = value;
    setAtPath(this.shared, <string>key, value);
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

export interface GSActor {
  type: ACTOR_TYPE;
  tenant_id: string;
  name: string; // Fully qualified name
  id: string; // id of the actor
  data: {[key: string]: any; } | {}; //Other information in key value pairs. For example IP address
}


if (require.main === module) {
  let sum = (a: number, b: number):  number => {
    // ctx.addEvent(new GSEvent());
    console.log('Hello world', new Date(), a + b)
    return a+b;
  };
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
  const sumGSFunction = new GSFunction('sum', sum, [1,2],);
  const sumOtherGSFunction = new GSFunction('sumOther', sum, [3,2],);
  //const i = new GSFunction('seriesExample', seriesExecutor, [{children: [sumGSFunction, sumOtherGSFunction]}], null, null, 'series' );
   

  // //Set pre auths
  // i.preAuthHooks.push(createSpan);
  // i.finally = [closeSpan, sendLogs];

  //i.execute(new GSContext({})).then((ctx) => console.log(JSON.stringify(ctx.outputs))).catch(console.log)
  //sync request : grpc and http
  //async request - response

}

async function seriesExecutor (ctx: GSContext, children: GSAction[]) {
  console.log('inside series executor', ctx, children)
  for await (const child of children) {
    if (child instanceof GSFunction) {
      ctx = await (<GSFunction>child).execute(ctx)
    }
  }
  //return ctx;
}
async function parallelExecutor (ctx: GSContext, children: GSAction[]) {
  console.log('inside parallel executor', ctx, children)
  const promises = [];
  for (const child of children) {
    if (child instanceof GSFunction) {
     promises.push((<GSFunction>child).execute(ctx));
    }
  }
  return await promises;
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

