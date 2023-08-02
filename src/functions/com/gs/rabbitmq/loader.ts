import { RabbitmqMessageBus } from './rabbitmq'


exports.default = function loader(datasource: { [key: string]: any; }) {
    const ds = {
        ...datasource,
        client: new RabbitmqMessageBus(datasource.config)
    };
    return ds;
}
