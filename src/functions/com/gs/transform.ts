import { GSContext } from "../../../core/interfaces";
import { PlainObject } from "../../../types";

/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/

export default function (ctx: GSContext, args: any) {
  if (!ctx.forAuth) {
    if (typeof(args) != "object") {
      return {
        success: true,
        code:200,
        data: args
      };
    } else {
      return args;
    }
  }
  //In case for authorization flow
  if (args === true) {
    return {success: true};
  }
  args = args as PlainObject;
  if (!args) {
    return {
      success: false,
      code: 403
    };
  }
  return {success: args.success || false, code: args.code || (!args.success && 403) || 200, message: args.message, data: args.data};
}