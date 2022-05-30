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
