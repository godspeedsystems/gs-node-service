import loadDatasources from "../../../core/datasourceLoader";

export default async function() {
    const datasources = await loadDatasources(__dirname + '/datasources'); 
    const evaluatedDatasources = datasources.kafka1({}, {}, {}, {});
    const args = {
        config: {
            "topic": "myTopic",

           
        },
        data: {
            myTopic:"user1",
            value: 'message-y'
        },
        params: null,
        datasource: undefined
    };
    args.datasource = evaluatedDatasources;

    return args;
}
