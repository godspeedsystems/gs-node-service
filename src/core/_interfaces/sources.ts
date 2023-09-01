import { PlainObject } from "../../types";
import { GSCloudEvent, GSContext, GSStatus } from "../interfaces";


interface ISource {
  config: PlainObject;

  client: false | PlainObject;

  init: Function;

  initClient: () => Promise<PlainObject>
}

interface IDataSource extends ISource {
  execute: (
    ctx: GSContext,
    args: PlainObject,
  ) => Promise<any>
}

interface IEventSource extends ISource {
  subscribeToEvent: (
    eventKey: string,
    eventConfig: PlainObject,
    processEvent: (event: GSCloudEvent, eventConfig: PlainObject) => Promise<GSStatus>,
  ) => Promise<void>
}

export abstract class Source implements ISource {
  config: PlainObject;

  client: false | PlainObject;

  constructor(config: PlainObject, client?: PlainObject) {
    this.config = config;
    this.client = client || false;
  }

  async init() {
    this.client = await this.initClient();
  }

  abstract initClient(): Promise<PlainObject>;
};

export abstract class DataSource extends Source implements IDataSource {
  abstract execute(
    ctx: GSContext,
    args: PlainObject,
  ): Promise<any>
};

export abstract class DatasourceAsEventSource extends Source implements IEventSource {
  abstract subscribeToEvent(
    eventKey: string,
    eventConfig: PlainObject,
    processEvent: (event: GSCloudEvent, eventConfig: PlainObject) => Promise<GSStatus>,
  ): Promise<void>
};

export abstract class EventSource extends DataSource implements IEventSource {
  abstract subscribeToEvent(
    eventKey: string,
    eventConfig: PlainObject,
    processEvent: (event: GSCloudEvent, eventConfig: PlainObject) => Promise<GSStatus>,
  ): Promise<void>
}
// example 1: redis
class RedisAsDataSource extends DataSource {
  initClient(): Promise<PlainObject> {
    throw new Error("Method not implemented.");
  }

  execute(ctx: GSContext, args: PlainObject): Promise<any> {
    throw new Error("Method not implemented.");
  }
}

class RedisEventSource extends DatasourceAsEventSource {
  subscribeToEvent(eventKey: string, eventConfig: PlainObject, processEvent: (event: GSCloudEvent, eventConfig: PlainObject) => Promise<GSStatus>): Promise<void> {
    throw new Error("Method not implemented.");
  }

  initClient(): Promise<PlainObject> {
    throw new Error("Method not implemented.");
  }
}

// example 2: express
class RedisDatasourceAsEventSource extends EventSource {
  subscribeToEvent(eventKey: string, eventConfig: PlainObject, processEvent: (event: GSCloudEvent, eventConfig: PlainObject) => Promise<GSStatus>): Promise<void> {
    throw new Error("Method not implemented.");
  }

  execute(ctx: GSContext, args: PlainObject): Promise<any> {
    throw new Error("Method not implemented.");
  }

  initClient(): Promise<PlainObject> {
    throw new Error("Method not implemented.");
  }
}



////

export abstract class GSDataSource {

  config: PlainObject;

  client?: object;

  constructor(
    config: PlainObject,
  ) {
    this.config = config;
  }

  async init() {
    const client = await this.initClient();
    this.client = client;
  }

  // Should return client of this datasoure
  protected abstract initClient(): Promise<object>;

  abstract execute(
    ctx: GSContext,
    args: PlainObject,
  ): Promise<any>
}

export abstract class GSEventSource {
  config: PlainObject;

  datasource: GSDataSource;

  constructor(
    config: PlainObject,
    datasource: GSDataSource,
  ) {
    this.config = config;
    this.datasource = datasource;
  };

  abstract subscribeToEvent(
    eventKey: string,
    eventConfig: PlainObject,
    processEvent: (event: GSCloudEvent, eventConfig: PlainObject) => Promise<GSStatus>,
  ): Promise<void>
}
