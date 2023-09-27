import fs from "fs";
import path from 'path';
//@ts-ignore
import yaml from "js-yaml";
import glob from "glob";

import SourceMap from "js-yaml-source-map";
import sourcemap from './sourcemap';
import { transpile, randomNameGenerator, prepareScript } from "./script";

const eof = (name: string) => `\n//# sourceMappingURL=${name}`;

function emitfn(task: { args: any, fn: string }) {
  return `const args=${JSON.stringify(task.args)}\nreturn executefn(ctx, 0, global.functions['${task.fn}'], args)\n`;
}

function transpileTask(task: any, map: any, prefix: string, mapping: any, generator: any) {
  task.location = map.lookup(prefix);
  const fn: any = map.lookup(`${prefix}.fn`);
  const args: any = map.lookup(`${prefix}.args`);
  mapping.source_line = args.line;

  const str = JSON.stringify(task.args);

  let code;
  if (str.match(/<(.*?)%/) && str.match(/%>/)) {
    code = transpile(task.args, mapping, generator, task.fn, fn);
  } else {
    mapping.generated_line++;
    console.log(mapping);
    code = emitfn(task);
    generator.addMapping({
      source: mapping.filename,
      original: { line: args.line, column: 0 },
      generated: { line: mapping.generated_line++, column: 0 },
    });
    generator.addMapping({
      source: mapping.filename,
      original: { line: fn.line, column: 0 },
      generated: { line: mapping.generated_line, column: 0 },
    });
  }

  //console.log('code', code)

  return code;
}

let ifFunctions: any = {};

function gsSeriesFunction(yaml: any, map: any, prefix: string, mapping: any, generator: any, level: number, workflowName: string, inside?: boolean,) {
  let code = ''; let fun;

  if (inside) {
    fun = randomNameGenerator(10);
    code = 'async function ' + fun + '(ctx) {\n';
    mapping.generated_line++;
  }

  for (let i = 0; i < yaml.tasks.length; ++i) {
    const location = `${prefix}.${i}`;
    code += transpileTasks(yaml.tasks[i], map, location, mapping, generator, level + 1, workflowName);
  }

  //console.log(yaml)
  for (let task of yaml.tasks) {
    if (!['com.gs.elif', 'com.gs.else'].includes(task.fn)) {
      code += `outputs['${task.id}'] = await ${task.fun}()\n`;
      generator.addMapping({
        source: mapping.filename,
        original: task.location,
        generated: { line: mapping.generated_line++, column: 0 },
      });
    }
  }

  code += `outputs['${yaml.id}'] = outputs['${yaml.tasks[yaml.tasks.length - 1].id}']\n`;
  mapping.generated_line++;

  if (inside) {
    code += '}\n';
    mapping.generated_line++;
  }

  return { code, fun };
}

function emitIf(yaml: any, map: any, mapping: any, generator: any, level: number) {
  let code = '';

  if (ifFunctions[level]?.length && !['com.gs.elif', 'com.gs.if'].includes(yaml.fn)) {
    for (const f of ifFunctions[level]) {
      let [s, cond, fn, prefix] = f;
      if (code) {
        code += `\n${s} `;
        mapping.generated_line++;
      } else {
        code += `${s} `;
      }

      if (cond) {
        const location = map.lookup(prefix);
        generator.addMapping({
          source: mapping.filename,
          original: location,
          generated: { line: mapping.generated_line, column: 0 },
        });
        code += `(${cond}()) {\n`;
        mapping.generated_line++;
      } else {
        code += `{\n`;
        mapping.generated_line++;
      }

      code += `await ${fn}()\n}`;
      const location = map.lookup(`${prefix}.tasks`);
      location.line--;
      generator.addMapping({
        source: mapping.filename,
        original: location,
        generated: { line: mapping.generated_line++, column: 0 },
      });
    }

    code += `\n}\n`;
    mapping.generated_line += 2;
    delete ifFunctions[level];
  }

  return code;
}

function transpileTasks(yaml: any, map: any, prefix: string, mapping: any, generator: any, level: number, workflowName: string) {
  yaml.fun = randomNameGenerator(10);

  console.log('prefix', prefix);

  if (!yaml.fn) {
    yaml.fn = 'com.gs.sequential';
  }

  if (!yaml.id) {
    yaml.id = 'main';
  }

  let code = '';

  if (yaml.fn != 'com.gs.elif') {
    code = 'async function ' + yaml.fun;
    if (level == 0) {
      code += '(ctx) {\n';
    } else {
      code += '() {\n';
    }
    mapping.generated_line++;
  }

  if (yaml.fn.includes('com.gs.')) {

    yaml.location = map.lookup(prefix);
    if (level == 0) {
      code += 'let inputs = ctx.inputs, config = ctx.config, outputs = ctx.outputs, datasources = ctx.datasources, mappings = ctx.mappings, plugins = ctx.plugins\n';
      mapping.generated_line++;
    }

    switch (yaml.fn) {
      case 'com.gs.sequential':
        let ret = gsSeriesFunction(yaml, map, prefix, mapping, generator, level, workflowName);
        code += ret.code;
        break;

      // case 'com.gs.dynamic_fn':
      //     return new GSDynamicFunction(yaml, workflows, nativeFunctions, undefined, tasks, false)

      case 'com.gs.parallel':
        for (let i = 0; i < yaml.tasks.length; ++i) {
          const location = `${prefix}.${i}`;
          code += transpileTasks(yaml.tasks[i], map, location, mapping, generator, level + 1, workflowName);
        }
        code += 'await Promise.all([' + yaml.tasks.map((t: any) => `${t.fun}()`).join(',') + '])\n';
        mapping.generated_line++;

        break;

      case 'com.gs.switch': {
        const obj: any = {};
        mapping.generated_line++;
        mapping.source_line = map.lookup(`${prefix}.value`).line;
        code += prepareScript(yaml.value, mapping, generator, obj) + '\n';
        //mapping.generated_line++

        for (let c in yaml.cases) {
          const location = `${prefix}.cases.${c}`;
          code += transpileTasks(yaml.cases[c], map, location, mapping, generator, level + 1, workflowName);
        }

        if (yaml.defaults) {
          const location = `${prefix}.defaults`;
          code += transpileTasks(yaml.defaults, map, location, mapping, generator, level + 1, workflowName);
        }

        code += `switch(${obj.fun}()) {\n`;
        let line = map.lookup(`${prefix}.fn`);
        mapping.generated_line++;
        console.log('generating mapping for swicth', line, mapping);
        generator.addMapping({
          source: mapping.filename,
          original: line,
          generated: { line: mapping.generated_line, column: 0 },
        });

        //console.log('cases', prefix)

        for (let c in yaml.cases) {
          code += `case ${c}:\n`;
          //console.log('code', code)
          mapping.generated_line++;
          const line = map.lookup(`${prefix}.cases.${c}`);
          line.line--;
          generator.addMapping({
            source: mapping.filename,
            original: line,
            generated: { line: mapping.generated_line++, column: 0 },
          });
          code += `return await ${yaml.cases[c].fun}()\nbreak;\n`;
          line.line++;
          generator.addMapping({
            source: mapping.filename,
            original: line,
            generated: { line: mapping.generated_line, column: 0 },
          });
          mapping.generated_line += 2;
        }

        if (yaml.defaults) {
          code += `default:\n`;
          mapping.generated_line++;
          const line = map.lookup(`${prefix}.defaults`);
          line.line--;
          generator.addMapping({
            source: mapping.filename,
            original: line,
            generated: { line: mapping.generated_line++, column: 0 },
          });
          code += `return await ${yaml.defaults.fun}()\n`;
        }

        code += `}\n`;
        mapping.generated_line++;
      }
        break;

      case 'com.gs.if': {
        const obj: any = {};
        mapping.source_line = map.lookup(`${prefix}.condition`).line;
        console.log(mapping);
        code += prepareScript(yaml.condition, mapping, generator, obj) + '\n';
        mapping.generated_line++;
        let ret = gsSeriesFunction(yaml, map, `${prefix}.tasks`, mapping, generator, level + 1, workflowName, true);
        code += ret.code;
        ifFunctions[level] = [];
        ifFunctions[level].push(['if', obj.fun, ret.fun, prefix]);
        console.log('if level', level, ifFunctions);
      }
        break;

      case 'com.gs.elif': {
        const obj: any = {};
        mapping.source_line = map.lookup(`${prefix}.condition`).line;
        code += prepareScript(yaml.condition, mapping, generator, obj) + '\n';
        code += 'async function ' + yaml.fun + '(ctx) {\n';
        mapping.generated_line += 2;
        let ret = gsSeriesFunction(yaml, map, `${prefix}.tasks`, mapping, generator, level + 1, workflowName, false);
        code += ret.code;
        if (!ifFunctions[level]?.length) {
          console.log("elif without if");
          process.exit(1);
        }
        ifFunctions[level].push(['else if', obj.fun, yaml.fun, prefix]);
      }
        break;

      case 'com.gs.else': {
        let ret = gsSeriesFunction(yaml, map, `${prefix}.tasks`, mapping, generator, level + 1, workflowName, false);
        code += ret.code;
        console.log('else level', level, ifFunctions);

        if (!ifFunctions[level]?.length) {
          console.log("else without if");
          process.exit(1);
        }
        ifFunctions[level].push(['else', null, yaml.fun, prefix]);
      }
        break;

      // case 'com.gs.each_parallel': {
      //         let args = [yaml.value]

      //         let task = new GSSeriesFunction(yaml, workflows, nativeFunctions, undefined, tasks, false)

      //         args.push(task)

      //         if (yaml?.on_error?.tasks) {
      //             yaml.on_error.tasks.workflow_name = yaml.workflow_name
      //             yaml.on_error.tasks = createGSFunction(yaml.on_error.tasks, workflows, nativeFunctions, null)
      //         }

      //         console.log('loading each parallel workflow %o', yaml.tasks)

      //         return new GSEachParallelFunction(yaml, workflows, nativeFunctions, undefined, args, false)
      //     }

      // case 'com.gs.each_sequential': {
      //         let args = [yaml.value]
      //         let task = new GSSeriesFunction(yaml, workflows, nativeFunctions, undefined, tasks, false)
      //         args.push(task)

      //         if (yaml?.on_error?.tasks) {
      //             yaml.on_error.tasks.workflow_name = yaml.workflow_name
      //             yaml.on_error.tasks = createGSFunction(yaml.on_error.tasks, workflows, nativeFunctions, null)
      //         }

      //         console.log('loading each sequential workflow %o', yaml.tasks)

      //         return new GSEachSeriesFunction(yaml, workflows, nativeFunctions, undefined, args, false)
      //     }

      default:
        console.log('calling single task fn', prefix);
        code += transpileTask(yaml, map, prefix, mapping, generator);
    }

    console.log("generating new line for function", yaml.fun, level);
  } else {
    console.log('calling single task fn', prefix);
    code += transpileTask(yaml, map, prefix, mapping, generator);
  }

  code += emitIf(yaml, map, mapping, generator, level - 1);

  if (yaml.fn != 'com.gs.if') {
    code += '}\n';

    if (level == 0) {
      code += `module.exports = async function(ctx) {
await ${yaml.fun}(ctx)
}
module.exports.id='${yaml.id}'\n
`;
      yaml.location.line--;
      generator.addMapping({
        source: mapping.filename,
        original: yaml.location,
        generated: { line: mapping.generated_line + 2, column: 0 },
      });
    }
  }

  if (yaml.fn != 'com.gs.elif' && ifFunctions[level]) {
    code += emitIf(yaml, map, mapping, generator, level);
  }
  mapping.generated_line++;

  return code;
}

function transpileFile(filePath: string) {
  if (!filePath) return false;

  console.log("transpiling file", filePath);
  const data = fs.readFileSync(filePath, "utf8");
  const map = new SourceMap();
  // pass map.listen() to the listener option
  const loaded = yaml.load(data, { listener: map.listen() });

  // const basePath = path.resolve(__dirname, '../functions');
  const basePath = filePath.split('/').pop();

  if (basePath && basePath.length) {
    const workflowName = filePath.replace(/.*?\/functions\//, '').replace(/\//g, '.').replace(/\.(yaml|yml)/i, '').replace(/\.index$/, '');
    console.log(basePath, workflowName);

    const namewithout = path.resolve(basePath, path.parse(filePath).name);
    const jsfile = namewithout + '.js';
    const mapfile = namewithout + '.js.map';
    const generator = sourcemap(filePath);

    const mapping = {
      filename: filePath,
      source_line: 1,
      generated_line: 2
    };

    const imports = "const {executefn} = require('#core/interfaces')\n";

    try {
      let code = transpileTasks(loaded, map, "tasks", mapping, generator, 0, workflowName);
      console.log("writing file", jsfile, mapfile);
      fs.writeFileSync(jsfile, imports + code + eof(mapfile));
      fs.writeFileSync(mapfile, generator.toString());
    } catch (ex) {
      console.log(ex);
    }
  }
}

(() => {
  let functionsFolder = process.argv[2];
  // let destinationFolder = process.argv[3];
  let destinationFolder = functionsFolder;

  if (!functionsFolder) {
    console.log('functionsFolder or destinationFolder is not defined');
    return;
  }

  glob(`${functionsFolder}/**/*.?(yaml|yml)`, function (err: Error | null, files: string[]) {
    if (err) {
      console.log('No yaml files found.');
    }

    // transpile path
    files.forEach(yamlFilePath => {
      transpileFile(yamlFilePath);
    });
  });
})();

// glob(process.env.PROJECT_ROOT_DIRECTORY + '/src/functions' + '/**/*.?(yaml|yml)', function (err: Error | null, res: string[]) {
//   console.log('transpiling files: %s', res);
//   if (!err) {
//     res.forEach(file => {
//       transpileFile(file);
//     });
//   }
// });