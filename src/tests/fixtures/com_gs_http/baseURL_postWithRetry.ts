import loadDatasources from "../../../core/datasourceLoader";

export default async function() {
    const datasources = await loadDatasources(__dirname + '/datasources'); 
    const args = {
        config: {
            "method": "get",
            "url": "/status_get",
            "timeout": 10
        },
        retry: {
            "max_attempts": 5,
            "type": "constant",
            "interval": 2000
        },
        params: null,
        datasource: undefined
    };
    args.datasource = datasources.swagger_base;
    return args;
}
