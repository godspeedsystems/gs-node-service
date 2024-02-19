import { PlainObject } from "../../types";
import { GSCloudEvent, GSContext, GSStatus } from "../interfaces";

export type EventSources = { [key: string]: GSEventSource | GSDataSourceAsEventSource };

export abstract class GSDataSource {
  config: PlainObject;

  client?: PlainObject;

  constructor(config: PlainObject) {
    this.config = config;
  };

  async init() {
    this.client = await this.initClient();
  }

  protected abstract initClient(): Promise<PlainObject>;

  abstract execute(
    ctx: GSContext,
    args: PlainObject,
  ): Promise<any>
};

export type RedisOptions = {
  EX? : number,
  PX? : number,
  EXAT?: number,
  NX?: boolean,
  XX?: boolean,
  KEEPTTL?: boolean,
  GET?: boolean
}
export abstract class GSCachingDataSource extends GSDataSource {

  //Redis options are available [here](https://redis.io/commands/set/) Client may or may not support all actions. RedisOptions is a superset based on what Redis supports
  public abstract set(key:string, val: any, options: RedisOptions): any; 

  public abstract get(key: string): any; //Return the value stored against the key

  public abstract del(key: string): any; //Delete the key
}

export abstract class GSDataSourceAsEventSource {
  config: PlainObject;

  // datasource: PlainObject;

  client: false | PlainObject;

  constructor(config: PlainObject, datasourceClient: PlainObject) {
    this.config = config;
    this.client = datasourceClient;
  };

  abstract subscribeToEvent(
    eventKey: string,
    eventConfig: PlainObject,
    processEvent: (event: GSCloudEvent, eventConfig: PlainObject) => Promise<GSStatus>,
    event?: PlainObject
  ): Promise<void>
};

export abstract class GSEventSource {
  config: PlainObject;

  client: false | PlainObject;

  datasources: PlainObject;

  constructor(config: PlainObject, datasources: PlainObject) {
    this.config = config;
    this.client = false;
    this.datasources = datasources;
  };

  public async init() {
    this.client = await this.initClient();
  }

  protected abstract initClient(): Promise<PlainObject>;

  abstract subscribeToEvent(
    eventKey: string,
    eventConfig: PlainObject,
    processEvent: (event: GSCloudEvent, eventConfig: PlainObject) => Promise<GSStatus>,
    event?: PlainObject
  ): Promise<void>
}