import { PlainObject } from "../../core/common";
import { PROJECT_ROOT_DIRECTORY } from '../../core/utils';
import { logger } from '../../core/logger';
import { GSDatasource } from "../../core/interfaces";
import loadFiles from '../../core/fileLoader';
import KafkaMessageBus from '../../kafka';

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
    }
    logger.debug('Loaded clients of all the files for kafka: %o', kafkaDatasources);
    return kafkaDatasources;
  };

  client = async function(config: PlainObject) {
    logger.debug('Configuration to load client for kafka: %o', config);
    return new KafkaMessageBus(config);
  };

}

export default async function() {
  const datasources = await new KafkaDatasource().loadClients();
  return datasources;
}

