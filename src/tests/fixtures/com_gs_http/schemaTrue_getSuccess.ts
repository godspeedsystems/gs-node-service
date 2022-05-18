import loadDatasources from "../../../core/datasourceLoader";

export default async function() {
    const datasources = await loadDatasources(__dirname + '/datasources'); 
    const args = {
        config: {
            "method": "get",
            "url": "/get"
        },
        params: null,
        retry: {
            "maxAttempt": 5,
            "type": "constant",
            "interval": 900000
        },
        datasource: undefined
    }
    args.datasource = datasources.swagger_ui;
    return args
}
