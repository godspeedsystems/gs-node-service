/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/

import Pino from 'pino';
import { GSContext } from '../../../core/interfaces';

export default function (ctx: GSContext, args: { level: Pino.Level, data: any }) {
    const { childLogger } = ctx;
    childLogger[args.level]({ "module": "com.gs.log" }, args.data);
}
