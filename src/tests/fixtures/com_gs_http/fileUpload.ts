import loadDatasources from "../../../core/datasourceLoader";

export default async function() {
    const datasources = await loadDatasources(__dirname + '/datasources'); 
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
    args.datasource = datasources.swagger_base;
    return args;
}
