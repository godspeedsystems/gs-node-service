import { PlainObject } from "../../types";
import { GSCloudEvent, GSContext, GSStatus } from "../interfaces";

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
  ): Promise<void>
};

export abstract class GSEventSource {
  config: PlainObject;

  client: false | PlainObject;

  constructor(config: PlainObject) {
    this.config = config;
    this.client = false;
  };

  public async init() {
    this.client = await this.initClient();
  }

  protected abstract initClient(): Promise<PlainObject>;

  abstract subscribeToEvent(
    eventKey: string,
    eventConfig: PlainObject,
    processEvent: (event: GSCloudEvent, eventConfig: PlainObject) => Promise<GSStatus>,
  ): Promise<void>
}