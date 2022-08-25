import loadDatasources from "../../../core/datasourceLoader";

export default async function() {
    const datasources = await loadDatasources(__dirname + '/datasources'); 
    const evaluatedDatasources = datasources.swagger_base({}, {}, {}, {});
    const args = {
        config: {
            "method": "get",
            "url": "/status/503"
        },
        retry: {
            "max_attempts": 2,
            "type": "constant",
            "interval": 2000
        },
        params: null,
        datasource: undefined
    };
    args.datasource = evaluatedDatasources;
    return args;
}
