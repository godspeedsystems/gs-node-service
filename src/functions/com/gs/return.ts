import { GSContext, GSStatus } from "../../../godspeed";
import { PlainObject } from "../../../types";

/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
export default function (ctx: GSContext, args: PlainObject) {
  if (args instanceof GSStatus || (typeof (args) == 'object' && (args.success !== undefined))) {
    args.exitWithStatus = true;
    return args;
  }
  return {success: true, code: 200, data: args, exitWithStatus: true };
}