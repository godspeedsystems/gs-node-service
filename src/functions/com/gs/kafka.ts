import { randomUUID } from "crypto";
import { logger } from "../../../core/logger";


export default async function kafka(args:{[key:string]:any;}) {
    logger.debug('com.gs.kafka args: %o',args);
    let kafka;
    if(args.datasource) {
        kafka = args.datasource.client;
    } else {
        kafka = args.kafka;
    }

    let data = args.data;

    if (!Array.isArray(args.data)) {
        data = [args.data];
    }

    let producer = await kafka.producer();

    logger.info('Sending messages to topic %s', args.config.topic);
    logger.debug('Sending messages to topic %s %o', args.config.topic, data);

    return producer.send({
        topic: args.config.topic,
        messages: data.map((message:any) => ({
            key: message.key,
            value: JSON.stringify(message.value),
            partition: message.partition,
            timestamp: message.timestamp,
            headers: message.headers
        })),
    });
}
