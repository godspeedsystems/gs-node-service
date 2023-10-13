/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import { PlainObject } from "./common.js"
//import { logger } from './logger.js'

import CoffeeScript from 'coffeescript'
import config from "config"
import fs from 'fs'
import { SourceMapGenerator } from "source-map"

export const imports = `
import * as fs from 'fs'
import * as assert from 'assert'
import * as buffer from 'buffer'
import * as child_process from 'child_process'
import * as cluster from 'cluster'
import * as dgram from 'dgram'
import * as dns from 'dns'
import * as events from 'events'
import * as http from 'http'
import * as https from 'https'
import * as net from 'net'
import * as os from 'os'
import * as path from 'path'
import * as querystring from 'querystring'
import * as readline from 'readline'
import * as stream from 'stream'
import * as string_decoder from 'string_decoder'
import * as timers from 'timers'
import * as tls from 'tls'
import * as url from 'url'
import * as util from 'util'
import * as zlib from 'zlib'
`

export interface  Mapping {filename: string, source_line: number, generated_line: number}

export const randomNameGenerator = (num: number) => {
   let res = ''
   for(let i = 0; i < num; i++){
      const random = Math.floor(Math.random() * 26)
      res += String.fromCharCode(97 + random)
   }
   return res
}


export function prepareScript(str: string, mapping: Mapping, generator: SourceMapGenerator, fn?: any): string {

  let langs = (/<(.*?)%/).exec(str)

  //@ts-ignore
  let lang = langs?.[1] ||  config.lang || 'coffee'

  str = str.trim()
  if (str.match(/^<(.*?)%/) && str.match(/%>$/)) {
    let temp = str.replace(/^<(.*?)%/, '').replace(/%>$/, '')
    if (!temp.includes('%>')) {
      str = temp
    }
  }

  //multiple <% %> in the same line
  if (str.match(/<(.*?)%/) && str.match(/%>/)) {
    str = "'" + str.replace(/<(.*?)%/g, "' + ").replace(/%>/g, " + '") + "'"
  }

  str = str.trim()
  const initialStr = str

  if (!/\breturn\b/.test(str)) {
    str = 'return ' + str
  }

  if (lang === 'coffee') {
    str = CoffeeScript.compile(str ,{bare: true})
  }
  const script_lines = initialStr.split("\n")
  const j = script_lines.length != 1 ? 2 : 0

  mapping.source_line += j
  if (fn) {
    mapping.generated_line++;
  }

  for (let i in script_lines) {
      console.log("generated line", mapping.source_line, mapping.generated_line, j, script_lines[i])
      generator.addMapping({
          source: mapping.filename,
          original: {line: mapping.source_line++, column: 0},
          generated: { line: mapping.generated_line++, column: 0 },
      })
  }

  mapping.source_line--
  let prepareScriptFunction: any

  try {
    const fun = randomNameGenerator(10)
    if (fn) {
      fn.fun = fun
    }
    prepareScriptFunction = `function ${fun}() {
    ${str.trim()}
}`
  } catch(err: any) {
    //logger.error('Caught exception in script compilation, script: %s', initialStr)
    //logger.error('exception: %o', err.stack)
    //process.exit(1)
  }

  return prepareScriptFunction
}

function compileScript(args: any, mapping: Mapping, generator: SourceMapGenerator, key?: string) {

  if (typeof(args) == 'object') {
    let str = ''
    let first = !key

    if (!key) {
        str = 'let params = ' + (Array.isArray(args) ? '[]': '{}') + '\n'
        key = 'params'
        mapping.generated_line++
    }

    for (let k in args) {
        //console.log(k, mapping)
        generator.addMapping({
            source: mapping.filename,
            original: {line: mapping.source_line, column: 0},
            generated: {line: mapping.generated_line++, column: 0 },
        })

        let newkey = `${key}['${k}']`
        const s = compileScript(args[k], mapping, generator, newkey)
        if (typeof(s) == 'string' && s.startsWith("function ")) {
            str += `${newkey} = (${s.replaceAll('\\', '')})()\n`
        } else {
            str += `${newkey} = ${typeof(s) == 'string' ? `"${s}"`:s}\n`
        }
        mapping.source_line++
    }

    if (first) {
        str += 'return params'
        mapping.generated_line++
    }

    return `function ${randomNameGenerator(10)}() {
${str.trim()}
}`
  } else if (typeof(args) == 'string') {
    if (args.match(/(^|\/):([^/]+)/)) {
      args = args.replace(/(^|\/):([^/]+)/g, '$1<%inputs.params.$2%>')
    }

    if (args.match(/<(.*?)%/) && args.includes('%>')) {
      //console.log('preparescript', args)
      return prepareScript(args, mapping, generator)
    }
  }

if (!key) {
    generator.addMapping({
        source: mapping.filename,
        original: {line: mapping.source_line, column: 0},
        generated: { line: mapping.generated_line++, column: 0 },
    })
}

  console.log("generated line", mapping, args)
  return args
}

export function transpile(args: any, mapping: Mapping, generator: SourceMapGenerator, fn: string, fn_line: any) {
    //console.log('mapping', mapping, args, Array.isArray(args))

    const ifNotNull = Array.isArray(args) ? '[]': (typeof(args) == 'object' ? '{}': null)

    let args_line = mapping.source_line

    if (ifNotNull) {
        args_line--
    }

    let code = 'const args=('
    generator.addMapping({
        source: mapping.filename,
        original: {line: args_line, column: 0},
        generated: { line: mapping.generated_line++, column: 0 },
    })

    code += `${compileScript(args, mapping, generator)})()\n`
    mapping.generated_line++
    //console.log('mapping', mapping)
    code += `return executefn(ctx, 0, global.functions['${fn}'], args)\n`
    generator.addMapping({
      source: mapping.filename,
      original: fn_line,
      generated: { line: mapping.generated_line++, column: 0 },
    })
    return code
}

//@ts-ignore
// const isMainModule = import.meta.url.endsWith(process.argv[1])

// if (isMainModule) {
//     fs.writeFileSync('generated.js', imports + '\nconst args=(' + compileScript({
//         a: 10,
//         b:  "<% 'Samba' %>",
//         c: `
// <js%
//     const s = 'Hello'
//     const t = 'World'

//     return \`\${s} \${t}\`
// %>`}) + ')()')
// }