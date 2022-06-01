import loadDatasources from "../../../core/datasourceLoader";

export default async function() {
    const datasources = await loadDatasources(__dirname + '/datasources'); 
    const args = {
        config: {
            "method": "get",
            "url": "/status/503"
        },
        retry: {
            "max_attempts": 2,
            "type": "random",
            "min_interval": 1000,
            "max_interval": 3000
        },
        params: null,
        datasource: undefined
    };
    args.datasource = datasources.swagger_base;
    return args;
}
