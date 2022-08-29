import loadDatasources from "../../../core/datasourceLoader";

export default async function() {
    const datasources = await loadDatasources(__dirname + '/datasources'); 
    const evaluatedDatasources = datasources.swagger_base({}, {}, {}, {});
    const args = {
        config: {
            "method": "post",
            "url": "/anything"
        },
        files: [
                {
                    "name": __filename,
                    "tempFilePath": __filename
                }
            ],
        params: null,
        datasource: undefined
    };
    args.datasource = evaluatedDatasources;
    return args;
}
