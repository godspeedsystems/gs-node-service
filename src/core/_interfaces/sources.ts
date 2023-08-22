import { PlainObject } from "../../types";
import { GSCloudEvent, GSContext, GSStatus } from "../interfaces";

export abstract class DataSource {

  config: PlainObject;

  client?: object;

  constructor(config: PlainObject) {
    this.config = config;
  }


  async init() {
    const client = await this.initClient();
    this.client = client;
  }

  //Should retuyrn client of this datasoure
  protected abstract initClient(): Promise<object>;

  abstract execute(ctx: GSContext, args: PlainObject): Promise<any>
}

export abstract class EventSource {
  config: PlainObject;

  datasource: DataSource;

  constructor(config: PlainObject, datasource: DataSource) {
    this.config = config;
    this.datasource = datasource;
  };

  abstract subscribeToEvent(eventKey: string, eventConfig: PlainObject, processEvent: (event: GSCloudEvent, eventConfig: PlainObject) => Promise<GSStatus>): Promise<void>
}
