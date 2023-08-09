export function getDataSourceByName(datasourceName: string) {
    //@ts-ignore
    return global.datasources[datasourceName].client;
}