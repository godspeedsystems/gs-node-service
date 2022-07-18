import { PlainObject } from "../../core/common";
import { PROJECT_ROOT_DIRECTORY } from '../../core/utils';
import { logger } from '../../core/logger';
import { GSDatasource, GSActor, GSCloudEvent } from "../../core/interfaces";
import loadFiles from '../../core/fileLoader';
import { Consumer, Kafka, Producer }  from 'kafkajs';
import axios from 'axios';
import nodeCleanup from 'node-cleanup';
import { reject } from "lodash";

class KafkaMessageBus {
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
              logger.info('KafkaMessageBus: calling kafka producer disconnect...');
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
            logger.info('KafkaMessageBus: calling kafka consumer disconnect...');
            //@ts-ignore
            this.disconnect();
          }.bind(fn));
      }

      return this.consumers[groupId];
  }

  async subscribe(datasourceName: string, topic: string, groupId: string, processEvent:(event: GSCloudEvent)=>Promise<any>) {

      if (this.consumers[groupId]) {
        logger.info('KafkaMessageBus: kafka consumer already setup and running...');
        return;
      }

      let consumer = await this.consumer(groupId);

      try {
        await consumer.subscribe({ topic });

        const self = this;

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const data =  JSON.parse(message?.value?.toString() || '');
                logger.debug('datasourceName %s topic %s partition %o data %o', datasourceName, topic, partition, data);
                const event = new GSCloudEvent('id', `${topic}.message_bus.${datasourceName}.${groupId}`, new Date(message.timestamp), 'kafka',
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

/*
  To add datasource as plugins, declare a class which implements GSDatasource interface
  These three class members should be defined:
  - fileExtension: string 
    file extension of the datasource files which will use this datasource plugins
  - loadClients: Promise<PlainObject>
    Function to load clients. It takes path as input and return a promise of PlainObject 
    which means it returns an object with following key/value pair:
     {'name of the datasource': 'client of this datasource'}
      E.g. If datasource file is kafka1.kafka then it returns => {'kafka1': 'message_bus client'}
*/
class KafkaDatasource implements GSDatasource {
  fileExtension: string = '.kafka';

  loadClients = async(path: string = PROJECT_ROOT_DIRECTORY + '/datasources'): Promise<PlainObject> => {
    logger.info('Loading datasource plugins for kafka');
    const kafkaDatasources: PlainObject = {};  
    const datasourceFiles: PlainObject = await loadFiles(path, this.fileExtension, false); 
    logger.debug('Loaded files with extension %s: %o', this.fileExtension, datasourceFiles);
  
    logger.info('Loading clients of all the files for kafka');
    for (let ds in datasourceFiles) {
      kafkaDatasources[ds] = await this.client(datasourceFiles[ds]);
      if(!kafkaDatasources[ds]) {
        logger.error('Error in loading datasource %s, client not found. Exiting.',ds);
        process.exit(1);
      }
    }
    logger.debug('Loaded clients of all the files for kafka: %o', kafkaDatasources);
    return kafkaDatasources;
  };

  client = async function(config: PlainObject) {
    if(config) {
      logger.debug('Configuration to load client for kafka: %o', config);
      return new KafkaMessageBus(config);  
    } else {
      return undefined;
    }
  };

}

export default async function() {
  const datasources = await new KafkaDatasource().loadClients();
  return datasources;
}

