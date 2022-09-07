/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
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
            "type": "exponential",
            "interval": 400
        },
        params: null,
        datasource: undefined
    };
    args.datasource = evaluatedDatasources;
    return args;
}
