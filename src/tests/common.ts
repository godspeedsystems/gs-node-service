/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import chai from 'chai';
import mocha from 'mocha';
import glob from 'glob';
import path from 'path';
import fs from 'fs';
import { PlainObject } from '../core/common';
import { logger } from '../core/logger';

const describe = mocha.describe;
const it = mocha.it;
const expect = chai.expect;
let expectObj:PlainObject = {};

const fixDir = path.join(__dirname , 'fixtures');

/* 
 Read *.output files of all sub directories inside fixtures/ directory
 and put them in expectObj
*/
logger.debug('Reading all *.output files under %s',fixDir);
fs.readdir(fixDir, function (err, subDir) {
    logger.debug('Reading *.output files from %s',subDir);
    subDir.forEach(function (dir) {
        expectObj[dir] = {};
        glob( path.join(__dirname , 'fixtures' , dir , '/*.?(output)'), function (err:Error|null, res: string[]) {
            res.map((file:string) => {
                const testId = path.basename(file).replace(/\.(output)/i, '');
                expectObj[dir][testId] = JSON.parse(fs.readFileSync(file, 'utf-8'));
            });
        });
    });
});

export { describe, it, expect, glob, path, fs, expectObj };
