
import sourceMap from "source-map";
//var fs = require('fs')

export default function(file: string) {
    return new sourceMap.SourceMapGenerator({
        file: file,
    });
}

// generator.addMapping({
//     source: "fn.ys",
//     original: { line: 1, column: 0 },
//     generated: { line: 1, column: 3 },
//     name: "id: Hello World"
// });

// generator.addMapping({
//     source: "fn.ys",
//     original: { line: 2, column: 5 },
//     generated: { line: 2, column: 0 },
//     name: "console.log"
// });

// generator.addMapping({
//     source: "fn.ys",
//     original: { line: 3, column: 7 },
//     generated: { line: 2, column: 14 },
//     name: "Hello World"
// });

// generator.setSourceContent(
//     "fn.ys",
//     fs.readFileSync("fn.ys").toString("utf-8")
// );

// console.log(generator.toString())