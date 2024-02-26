import { GSContext } from "../../../godspeed";
import { PlainObject } from "../../../types";

/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
export default function (ctx: GSContext, args: PlainObject) {
  let success = args.success;
  let code = args.code;
  delete args.success;
  delete args.code;

  if (ctx.forAuth) {
    success = success !== undefined && success !== null ? success : false;;
    code = code || (!success && 403) || 200;
  } else {
    success = success !== undefined && success !== null ? success : true;
    code = code || 200;
  }

  return {success: success, code: code, data: args, exitWithStatus: true };
}