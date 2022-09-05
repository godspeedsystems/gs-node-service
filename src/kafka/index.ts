import { Consumer, Kafka, Producer, logLevel as kafkaLogLevel }  from 'kafkajs';
import axios from 'axios';
import config from 'config';

import { GSActor, GSCloudEvent, GSStatus } from '../core/interfaces';
import { logger } from '../core/logger';

import nodeCleanup from 'node-cleanup';
import { PlainObject } from '../core/common';
import Pino from 'pino';
import { promClient } from '../telemetry/monitoring';

// Create kafka metrics
const labels = ['topic', 'partition', 'status'];
const kafkaCount = new promClient.Counter({
    name: 'kafka_events_total',
    help: 'Counter for total kafka events consumed',
    labelNames: labels
});

const kafkaDuration = new promClient.Histogram({
    name: 'kafka_events_duration_seconds',
    help: 'Duration of Kafka events in seconds',
    labelNames: ['topic', 'partition', 'status']
});

// Create a logCreator to customize kafkajs logs to Pino compatible logs
const pinoLogCreator = (logLevel: any) => ({ namespace, level, label, log }: { namespace: any; level: any; label: any; log: any; }) => {
  delete log.timestamp;
  const pinoLevel = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
  const currLogLevel: number = level;

  const indexOfKey = Object.values(kafkaLogLevel).indexOf(currLogLevel as unknown as kafkaLogLevel);
  const kafkaLogLevelKey = Object.keys(kafkaLogLevel)[indexOfKey];

  const logPinoLevel: Pino.Level = (kafkaLogLevelKey.toLowerCase() as Pino.Level);

  if (pinoLevel.includes(logPinoLevel) ) {
    logger[logPinoLevel]({
      ...log
    });          
  } else {
    logger.info({
      ...log
    });
  }
};

export default class KafkaMessageBus {
    config: Record<string, any>;

    kafka: Kafka;

    consumers: Record<string, Consumer> = {};

    subscribers: Record<string, boolean> = {};

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
              logger.error('Caught error in producer %o', error);
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
              logger.error('Caught error in consumer %o', error);
            }
            nodeCleanup(function() {
              console.log('calling kafka consumer disconnect...');
              //@ts-ignore
              this.disconnect();
            }.bind(fn));
        }

        return this.consumers[groupId];
    }

    async subscribe(topic: string, groupId: string, datasourceName: string,  processEvent:(event: GSCloudEvent)=>Promise<any>) {

        if (this.subscribers[topic]) {
          logger.info('kafka consumer already setup and running...');
          return;
        }

        let consumer = await this.consumer(groupId);

        try {
          await consumer.subscribe({ topic });

          const self = this;

          await consumer.run({
              eachMessage: async ({ topic, partition, message }) => {
                  const labels: PlainObject = {'topic': topic, 'partition': partition};
                  const timer = kafkaDuration.startTimer(labels);

                  let data: PlainObject;
                  let msgValue; let status ;
                  try{
                    msgValue = message?.value?.toString();
                    data =  { 
                        "body": JSON.parse(msgValue || '') 
                      };
                  } catch(ex) {
                    status = 500;
                    kafkaCount.inc({topic, partition, status});
                    labels.status = status;
                    timer();

                    logger.error('Error in parsing kafka event data %s . Error message: %s .',msgValue, ex);
                    return new GSStatus(false, 500, `Error in parsing kafka event data ${msgValue}`,ex);
                  }
                  logger.debug('topic %s partition %o datasourceName %s groupId %s data %o', topic, partition, datasourceName, groupId, data);
                  const event = new GSCloudEvent('id', `${topic}.${datasourceName}.${groupId}`, new Date(message.timestamp), 'kafka',
                      '1.0', data, 'messagebus', new GSActor('user'),  {messagebus: {kafka: self}});
                  const res = await processEvent(event);

                  if (!res) {
                    status = 500;
                    kafkaCount.inc({topic, partition, status});
                    labels.status = status;
                    timer();
                  } else {
                    status = 200;
                    kafkaCount.inc({topic, partition, status});
                    labels.status = status;
                    timer();
                  }

                  return res;
              },
          });
          this.subscribers[topic] = true;
        } catch(error){
          logger.error('Caught error in subscribe %o', error);
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
              logCreator: pinoLogCreator
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
