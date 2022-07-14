import { randomUUID } from "crypto";
import { logger } from "../../../core/logger";

export default async function kafka(args:{[key:string]:any;}) {
    logger.debug('args inside com.gs.kafka: %o',args);

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
