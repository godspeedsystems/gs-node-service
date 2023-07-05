export function getDataSourceByName(datasourceName:any) {
    // @ts-ignore
    return global.datasources[datasourceName].client;
}