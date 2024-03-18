import { GSContext } from "../../../godspeed";
import { PlainObject } from "../../../types";
import transform from './transform';

/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
export default function (ctx: GSContext, args: PlainObject) {
  // We support deprecated v1 way of com.gs.return which was different in behavior with com.gs.transform
  // So check if we have to support deprecated logic of return or the v2 logic of return
  const v2Logic = !ctx.config.defaults?.returnV1Compatible;

  if (v2Logic) { //whether for authz or not
    const transformRes = transform(ctx, args);
    transformRes.exitWithStatus = true;
    return transformRes;
  } else {
    return { success: true, code: 200, data: args, exitWithStatus: true };
  }
}
