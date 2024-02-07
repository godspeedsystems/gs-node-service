/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { randomUUID } from "crypto";
import { childLogger } from '../../../app';

export default async function kafka(args:{[key:string]:any;}) {
    childLogger.debug('com.gs.kafka args: %o',args);
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

    // childLogger.info('Sending messages to topic %s', args.config.topic);
    childLogger.debug('Sending messages to topic %s %o', args.config.topic, data);

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
