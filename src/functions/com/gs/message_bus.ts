import { randomUUID } from "crypto";
import { logger } from "../../../core/logger";

export default async function message_bus(args:{[key:string]:any;}) {
    logger.debug('com.gs.message_bus args: %o',args);

    let ds = args.datasource;

    let data = args.data;

    if (!Array.isArray(args.data)) {
        data = [args.data];
    }

    let producer = await ds.producer();

    logger.info('Sending messages to topic %s', args.config.topic);
    logger.debug('Sending messages to topic %s %o', args.config.topic, data);

    return producer.send({
        topic: args.config.topic,
        messages: data.map((value:any) => ({
            key: randomUUID(),
            value: JSON.stringify(value)
        })),
    });
}
