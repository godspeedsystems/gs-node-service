/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import loadDatasources from "../../../core/datasourceLoader";

export default async function() {
    const datasources = await loadDatasources(__dirname + '/datasources'); 
    const args = {
        config: {
            method: 'user.findMany'
        },
        params: null,
        data: {},
        datasource: undefined
    };
    args.datasource = datasources.mongo;
    return args;
}
