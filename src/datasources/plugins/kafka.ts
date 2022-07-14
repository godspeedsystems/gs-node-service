//Every datasource will have type field. And anything else required for its functions to execute.

import { PlainObject } from "../../core/common";
import { PROJECT_ROOT_DIRECTORY } from '../../core/utils';
import { logger } from '../../core/logger';
import loadDatasourceFiles from '../../core/datasourceFileLoader';
import KafkaMessageBus from '../../kafka';

// EXAMPLE enum DS_TYPES {
//     REST,
//     datastore,
//     message_bus,
//     soap,
//     graphQl,
//     gRpc
// }
// interface Datasource {
//     type: string, //The type of the datastore
//     file_extension: string, //The file extension which uniquely identifies this datastore
//     loader(file_extension: string)//Loading function for the file extension
// }
const kafkaDatasources: PlainObject = {};
const file_extension: string = '.kafka';

export default async function loader() {
  const pathString = PROJECT_ROOT_DIRECTORY + '/datasources';
  const datasourceFiles = await loadDatasourceFiles(pathString, file_extension, false); 
  logger.debug('files with extension %s: %o', file_extension, datasourceFiles);

  for (let ds in datasourceFiles) {
    kafkaDatasources[ds] = await loadClient(datasourceFiles[ds]);
  }
  return kafkaDatasources;
}

export async function loadClient(config: PlainObject) {
  return new KafkaMessageBus(config);
}
