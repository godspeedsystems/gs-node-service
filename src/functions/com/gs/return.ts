import { P } from "pino";
import { GSContext, GSStatus } from "../../../godspeed";
import { PlainObject } from "../../../types";

/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
export default function (ctx: GSContext, args: PlainObject) {
  let success = args.success;
  let code;
  delete args.success;
  if (ctx.forAuth) {
    success = success || false;
    code = args.code || 403;
  } else {
    success = true;
    code = args.code || 200;
  }
  
  delete args.code;
  return {success: success, code: code, data: args, exitWithStatus: true };
}