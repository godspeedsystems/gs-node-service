import { GSContext, GSStatus } from "../../../core/interfaces";
import { PlainObject } from "../../../types";

/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/

export default function (ctx: GSContext, args: PlainObject | boolean) {
  if (!ctx.forAuth) {
    return args;
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
    }
  }
  return {success: args.success || false, code: args.code || (!args.success && 403) || 200, message: args.message, data: args.data};
  // //Here, args are expected to be in GSStatus format
  // //There may also be data key in args, for datasource plugins
  // //In that case, 
  // //Remove code and success if present from the args, and 
  // let success = args.success;
  // let code;
  // delete args.success;
  // success = success || false;
  // if (!args.code && !success) {
  //   code = args.code || 403;
  // }
  // delete args.code;
// return {success: success, code: code, data: args };
  
  
}