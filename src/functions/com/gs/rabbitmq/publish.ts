export default async function publish(args: { [key: string]: any; }) {
if (args.datasource) {
        const { exchange, routingKey, data } = args;
        return await args.datasource.client.publish({ exchange, routingKey, data });
    } else {
        return { success: false, code: 500, data: 'datasource not found in the workflow' };
    }
}
