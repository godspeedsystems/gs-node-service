export function getDataSourceByName(datasourceName) {
    return global.datasources[datasourceName].client;
}