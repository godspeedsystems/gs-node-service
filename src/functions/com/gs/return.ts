import { GSContext } from "../../../godspeed";
import { PlainObject } from "../../../types";

/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
export default function (ctx: GSContext, args: PlainObject) {
  let success = args.success;
  let code = args.code;
  const v1Compatible = args.returnV1Compatible;
  delete args.success;
  delete args.code;
  delete args.returnV1Compatible;

  if (ctx.forAuth) {
    success = success !== undefined && success !== null ? success : false;
    code = code || (!success && 403) || 200;
  } else {
    success = v1Compatible ? true : (success !== undefined && success !== null ? success : true);
    code = v1Compatible ? 200 : code || 200;
  }

  return {success: success, code: code, data: v1Compatible ? args : args.data, exitWithStatus: true };
}