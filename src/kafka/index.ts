import { Consumer, Kafka, Producer }  from 'kafkajs';
import axios from 'axios';
import config from 'config';

import { GSActor, GSCloudEvent } from '../core/interfaces';
import { logger } from '../core/logger';

import nodeCleanup from 'node-cleanup';

export default class KafkaMessageBus {
    config: Record<string, any>;

    kafka: Kafka;

    consumers: Record<string, Consumer> = {};

    _producer?: Producer;

    async producer() {
        if (!this._producer) {
            let p = this.kafka.producer();
            try {
              await p.connect();
              nodeCleanup(function() {
                console.log('calling kafka producer disconnect...');
                //@ts-ignore
                this.disconnect();
              }.bind(p));
              this._producer = p;
            } catch(error){
              logger.error(error);
            }

        }

        return this._producer;
    }

    async consumer(groupId: string) {
        if (!this.consumers[groupId]) {
            let fn = this.consumers[groupId] = this.kafka.consumer({ groupId });
            try {
              await  this.consumers[groupId].connect();
            } catch(error){
              logger.error(error);
            }
            nodeCleanup(function() {
              console.log('calling kafka consumer disconnect...');
              //@ts-ignore
              this.disconnect();
            }.bind(fn));
        }

        return this.consumers[groupId];
    }

    async subscribe(topic: string, groupId: string, processEvent:(event: GSCloudEvent)=>Promise<any>) {

        if (this.consumers[groupId]) {
          logger.info('kafka consumer already setup and running...');
          return;
        }

        let consumer = await this.consumer(groupId);

        try {
          await consumer.subscribe({ topic });

          const self = this;

          await consumer.run({
              eachMessage: async ({ topic, partition, message }) => {
                  const data =  JSON.parse(message?.value?.toString() || '');
                  logger.debug('topic %s partition %o data %o', topic, partition);
                  const event = new GSCloudEvent('id', `${topic}.kafka.${groupId}`, new Date(message.timestamp), 'kafka',
                      '1.0', data, 'messagebus', new GSActor('user'),  {messagebus: {kafka: self}});
                  return processEvent(event);
              },
          });
        } catch(error){
          logger.error(error);
        }
    }

    constructor(config: Record<string, any>) {
        this.config = config;

        logger.info('Connecting to kafka %o', config);

        let brokers = config.brokers;

        if (typeof(brokers) == 'string') {
          brokers = brokers.split(',').map(s => s.trim());
        }

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

        this.producer();
    }
}

export let kafka: KafkaMessageBus;

 //@ts-ignore
if (config?.kafka) {
    //@ts-ignore
    logger.info('kafka config %o', config?.kafka);

    //@ts-ignore
    kafka = new KafkaMessageBus(config?.kafka);
}