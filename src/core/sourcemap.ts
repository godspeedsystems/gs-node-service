import sourceMap from "source-map";
//var fs = require('fs')

export default function(file: string) {
    return new sourceMap.SourceMapGenerator({
        file: file,
    });
}