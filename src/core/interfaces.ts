import { Jsonnet } from '@hanazuki/node-jsonnet';
import { CHANNEL_TYPE, ACTOR_TYPE, EVENT_TYPE, PlainObject } from './common';
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
  id: string; // can be dot separated fqn
  args?: any;
  summary?: string;
  description?: string;
  fn?: Function;
  onError?: Function;
  
  constructor(id: string, _function?: Function, args?: any, summary?: string, description?: string, onError?: Function) {
    super('return arguments.callee._call.apply(arguments.callee, arguments)');
    this.id = id;
    this.fn = _function;
    this.args = args;
    this.summary = summary;
    this.description = description;
    this.onError = onError;
  }

  async _evaluateVariables(ctx: GSContext, args: any) {

    if (!args) {
      return;
    }

    let snippet = ctx.jsonnetSnippet;

    snippet += `
      local outputs = ${JSON.stringify(ctx.outputs).replace(/^"|"$/, '')};
    `

    if (typeof(args) != 'string') {
      args = JSON.stringify(args);
    }

    snippet += args.replace(/\"\${(.*?)}\"/g, "$1")
            .replace(/"\s*<transform>([\s\S]*?)<\/transform>[\s\S]*?"/g, '$1')
            .replace(/\\"/g, '"')
            .replace(/\\n/g, ' ')

    console.log(snippet);
    //console.log('outputs', ctx.outputs);

    return JSON.parse(await ctx.jsonnet.evaluateSnippet(snippet))
  }

  async _executefn(ctx: GSContext):Promise<GSStatus> {
    try {
      const args = await this._evaluateVariables(ctx, this.args);

      if (args.datasource) {
        args.datasource = ctx.datasources[args.datasource];
      }
      let res;
      
      if (Array.isArray(args)) {
        res = await this.fn?.apply(null, args)
      } else {
        res = await this.fn!(args)
      }

      console.log('result of _executeFn', res);
      
      if (res instanceof GSStatus) {
        return res; 
      } else {
        if (typeof(res) == 'object') {
          let {success, code, data, message, headers} = res;
          return new GSStatus(success, code, message, data, headers);
        }
        //This function gives a non GSStatus comliant return, then create a new GSStatus and set in the output for this function
        return new GSStatus(
          true,
          undefined,
          undefined,
          res
          //message: skip
          //code: skip
        );
      }
    } catch (err) {
      if (err instanceof Error) {
        //This function threw an error, so it has failed
        return new GSStatus(
          false,
          undefined,
          err.message,
          err.stack
        );
      }
    }

    //shouldn't come here
    return new GSStatus();
  }

  /**
   * 
   * @param instruction
   * @param ctx
   */
  async _call(ctx: GSContext) {
    
    //TODO: Later. Low priority: Execute all hooks one by one, in a reusable code manner
    if (this.fn instanceof GSFunction) {
      await this.fn(ctx);
    }
    else {
      ctx.outputs[this.id] = await this._executefn(ctx);
    }
    /**
     * If the call had an error, set that in events so that we can send it to the telemetry backend.
     */
    if (!ctx.outputs[this.id].success) {
      ctx.addLogEvent(new GSLogEvent('ERROR', ctx.outputs));
    }
  };
}

export class GSSeriesFunction extends GSFunction {
  override async _call(ctx: GSContext) {
    console.log('inside series executor', this.args)
    
    for (const child of this.args!) {
      await child(ctx);
    }
  }
}


export class GSParallelFunction extends GSFunction {
  override async _call(ctx: GSContext) {
    console.log('inside parallel executor', ctx, this.args)
    const promises = [];
    
    for (const child of this.args!) {
      promises.push(child(ctx));
    }

    await Promise.all(promises);
  }
}

export class GSSwitchFunction extends GSFunction {
  override async _call(ctx: GSContext) {
    console.log('inside switch executor', ctx, this.args)
    // tasks incase of series, parallel and condition, cases should be converted to args
    const [condition, cases] = this.args!;
    console.log("condition: " , condition)
    console.log("condition after replace: " , condition.replace(/\${(.*?)}/, '$1'))
    let value = await this._evaluateVariables(ctx, condition.replace(/\${(.*?)}/, '$1'));
    //evaluate the condition = 
    /*
    if ((condition as string).includes('${')) {
      value = (condition as string).replace('"\${(.*?)}"', '$1');
      console.log("******* value: ", value)
      //TODO: pass other context variables
      value = Function('config', 'return ' + condition)();
    }*/

    if (cases[value]) {
      await cases[value](ctx);
      console.log("cases: ", cases[value])
      console.log("cases.id: ", cases[value].id)
      console.log("Before: ", ctx.outputs)
      ctx.outputs[this.id] = ctx.outputs[cases[value].id]   
      console.log("After: ", ctx.outputs)
    } else {
      //check for default otherwise error
      if (cases.default) {
        await cases.default(ctx);
        console.log("default Before: ", ctx.outputs)
        ctx.outputs[this.id] = ctx.outputs[cases.default.id]
        console.log("default After: ", ctx.outputs)
      } else{
        //error
        ctx.outputs[this.id] = new GSStatus(false, undefined, `case ${value} is missing and no default found in switch`)
      }
    }
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
    this.data = data;
    this.success = success;
    this.headers = headers;
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
  shared: PlainObject; //This data, which can be having query promises, results, entities etc, when updated will get reflected across everyone using same instance of GSContext
  inputs: GSCloudEvent; //The very original event for which this workflow context was created
  outputs:{[key: string]: GSStatus; }; //DAG result. This context has a trace history and responses of all instructions in the DAG are stored in this object
  log_events: GSLogEvent[] = [];
  config: PlainObject; //app config
  datasources: PlainObject; //app config
  jsonnet: Jsonnet;
  mappings: any;
  jsonnetSnippet: string;

  constructor(config: PlainObject, datasources: PlainObject, 
      shared: PlainObject = {}, event: GSCloudEvent, mappings: any, jsonnetSnippet:string, plugins: PlainObject) {//_function?: GSFunction
    this.shared = shared;
    this.inputs = event;
    this.config = config;
    this.outputs = {};
    this.datasources = datasources;
    this.mappings = mappings;
    this.jsonnetSnippet = jsonnetSnippet;

    const jsonnet = this.jsonnet = new Jsonnet();
    
    jsonnet.extCode("inputs", JSON.stringify(event.data));
    jsonnet.extCode("config", JSON.stringify(this.config));
    jsonnet.extCode("mappings", JSON.stringify(this.mappings));

    for (let fn in plugins) {
      let name = fn.split('.').pop();
      const args = /\((.*?)\)/.exec(plugins[fn].toString());
      
      if (args) {
        let argArray = args[1].split(',').map(s => s.trim())
        console.log('plugin', name, argArray);
        jsonnet.nativeCallback(name!, plugins[fn], ...argArray);
      } else {
        jsonnet.nativeCallback(name!, plugins[fn]);
      }
    }
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

