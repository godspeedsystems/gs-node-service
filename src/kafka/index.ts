import { Consumer, Kafka, Producer }  from 'kafkajs';
import axios from 'axios';
import { GSActor, GSCloudEvent } from '../core/interfaces';
import { EventEmitter } from 'stream';


export default class KafkaMessageBus {
    config: Record<string, any>;

    kafka: Kafka;

    consumers: Record<string, Consumer> = {};
    
    _producer?: Producer;    

    async producer() {
        if (!this._producer) {
            this._producer = this.kafka.producer()
            await this._producer.connect();
        }

        return this._producer;
    }

    async consumer(groupId: string) {
        if (!this.consumers[groupId]) {
            this.consumers[groupId] = this.kafka.consumer({ groupId });
            await  this.consumers[groupId].connect();
        }

        return this.consumers[groupId];
    }

    async subscribe(topic: string, groupId: string, ee: EventEmitter, route: string) {
        let consumer = await this.consumer(groupId);

        await consumer.subscribe({ topic })
    
        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const event = new GSCloudEvent('id', route, new Date(message.timestamp), 'kafka', 
                    '1.0', message, 'messagebus', new GSActor('user'),  {messagebus: {kafka: this.kafka}});
                ee.emit(route, event);
            },
        })
    }

    constructor(config: Record<string, any>) {
        this.config = config;

        this.kafka = new Kafka({
            clientId: config.client_id,
            brokers: config.brokers ? config.brokers : async () => {
                //Getting brokers from Confluent REST Proxy
                const clusterResponse = await axios(`${config.kafka_rest_base_url}/v3/clusters`, {
                  headers:  {
                    Accept:  'application/vnd.api+json',
                  }
                })
                
                const clusterUrl = clusterResponse.data[0].links.self
            
                const brokersResponse = await axios(`${clusterUrl}/brokers`, {
                  headers: {
                    Accept: 'application/vnd.api+json',
                  }
                })
    
                const brokers = brokersResponse.data.map((broker: any) => {
                  const { host, port } = broker.attributes
                  return `${host}:${port}`
                })
            
                return brokers
              },
        })
    
    }
}

