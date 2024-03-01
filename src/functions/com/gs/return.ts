import { GSContext } from "../../../godspeed";
import { PlainObject } from "../../../types";
import transform from './transform';

/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
export default function (ctx: GSContext, args: PlainObject) {
  if (ctx.forAuth) {
    const success = args.hasOwnProperty('success') ? args.success : false;
    const code = args.code || (!args.success && 403) || 200;
    const data = args.hasOwnProperty('data') ? args.data : args;
    return { success, code, data, exitWithStatus: true };
  }
  const v1Compatible = ctx.mappings.default?.defaults?.returnV1Compatible;

  if (v1Compatible) {
    return { success: true, code: 200, data: args, exitWithStatus: true };
  } else {
    const transformRes = transform(ctx, args);
    if (typeof (transformRes) == 'object') {
      return {
        ...transformRes,
        exitWithStatus: true
      };
    } else {
      return {
        success: true,
        code: 200,
        data: transformRes,
        exitWithStatus: true
      };  
    }
  }
}