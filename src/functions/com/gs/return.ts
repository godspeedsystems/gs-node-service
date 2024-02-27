import { GSContext } from "../../../godspeed";
import { PlainObject } from "../../../types";

/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
export default function (ctx: GSContext, args: PlainObject) {
  let success;
  let code;
  let data;
  // delete args.success;
  // delete args.code;

  if (ctx.forAuth) {
    success = args.hasOwnProperty('success')  ? args.success: false;
    code = args.code || (!args.success && 403) || 200;
    data = args.hasOwnProperty('data') ? args.data : args;
  } else {
    const v1Compatible = ctx.config.returnV1Compatible;
    success = v1Compatible ? true : (args.hasOwnProperty('success') ? args.success : true);
    code = v1Compatible ? 200 : code || 200;
    if (v1Compatible) {
      data = args;
    } else {
      data = args.hasOwnProperty('data') ? args.data : args;
    }
  }

  return {success, code, data, exitWithStatus: true };
}