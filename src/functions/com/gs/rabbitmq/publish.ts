exports.default = function publish(args: { [key: string]: any; }) {
    if (args.datasource) {
        return args.datasource.client.publish(args);
    } else {
        return { success: false, code: 500, data: 'datasource not found in the workflow' };
    }
}