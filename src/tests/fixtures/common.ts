import chai from 'chai';
import mocha from 'mocha';
import glob from 'glob';
import path from 'path';
import fs from 'fs';
import { PlainObject } from '../../core/common';

const describe = mocha.describe;
const it = mocha.it;
const expect = chai.expect;

export { describe, it, expect, glob, path, fs, PlainObject };