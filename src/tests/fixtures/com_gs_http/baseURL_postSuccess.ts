import loadDatasources from "../../../core/datasourceLoader";

export default async function() {
    const datasources = await loadDatasources(__dirname + '/datasources'); 
    const evaluatedDatasources = datasources.swagger_base({}, {}, {}, {});
    const args = {
        config: {
            "method": "post",
            "url": "/anything"
        },
        data: {
            "TestData":"user1"
        },
        params: null,
        datasource: undefined
    };
    args.datasource = evaluatedDatasources;
    return args;
}
