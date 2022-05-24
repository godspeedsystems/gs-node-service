import { Consumer, Kafka, Producer }  from 'kafkajs';
import axios from 'axios';
import { GSActor, GSCloudEvent } from '../core/interfaces';
import { logger } from '../core/logger';


export default class KafkaMessageBus {
    config: Record<string, any>;

    kafka: Kafka;

    consumers: Record<string, Consumer> = {};
    
    _producer?: Producer;    

    async producer() {
        if (!this._producer) {
            this._producer = this.kafka.producer();
            try {
              await this._producer.connect();
            } catch(error){
              logger.error(error);
            }
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

    async subscribe(topic: string, groupId: string, processEvent:(event: GSCloudEvent)=>Promise<any>, route: string) {
        let consumer = await this.consumer(groupId);

        await consumer.subscribe({ topic });

        const self = this;
    
        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                //@ts-ignore
                const data =  JSON.parse(message?.value?.toString());
                logger.debug('data %o', data)
                const event = new GSCloudEvent('id', route, new Date(message.timestamp), 'kafka', 
                    '1.0', data, 'messagebus', new GSActor('user'),  {messagebus: {kafka: self}});
                return processEvent(event);
            },
        });
    }

    constructor(config: Record<string, any>) {
        this.config = config;

        logger.info('Connecting to kafka %o', config);

        this.kafka = new Kafka({
            clientId: config.client_id,
            brokers: config.brokers ? config.brokers : async () => {
                //Getting brokers from Confluent REST Proxy
                const clusterResponse = await axios(`${config.kafka_rest_base_url}/v3/clusters`, {
                  headers:  {
                    Accept:  'application/vnd.api+json',
                  }
                });
                
                const clusterUrl = clusterResponse.data[0].links.self;
            
                const brokersResponse = await axios(`${clusterUrl}/brokers`, {
                  headers: {
                    Accept: 'application/vnd.api+json',
                  }
                });
    
                const brokers = brokersResponse.data.map((broker: any) => {
                  const { host, port } = broker.attributes;
                  return `${host}:${port}`;
                });
            
                return brokers;
              },
        });

        //this.producer();
    }
}

