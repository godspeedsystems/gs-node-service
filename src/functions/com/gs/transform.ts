import { GSContext, GSStatus } from "../../../core/interfaces";
import { logger } from "../../../godspeed";

/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/

export default function (ctx: GSContext, args: any): GSStatus {

  if (!ctx.forAuth) {
    return nonAuthzFlow(args);
  } else {
    return authzFlow(args);
  }
}

function nonAuthzFlow (args: any) {
  //args is a non-object type
  if (typeof args !== 'object') {
    return {success: true, code: 200, data: args};
  }
  //args is an object. 
  //Now there will be two cases. Whether args is GSStatus, or just a plain object
  const argsHasSuccess = args.hasOwnProperty('success');
  const argsHasCode = args.hasOwnProperty('code');

  const code = args.code || 200; //code is always a number and 0 is not a valid code. when code is falsy value, default is 200.

  //For success boolean, handle success key is there but value is falsy, i.e. undefined or null or 0
  let success: boolean;
  if (args.success === undefined || args.success === null) {
    success = (code >= 200 && code < 400);  
  } else {
    success = !!args.success;
  }

  //Now handle cases where args is GSStatus or plain object
  if (argsHasSuccess || argsHasCode) { 
    // args is GSStatus
    return { success, code, data: args.data, message: args.message, headers: args.headers };
  } else { 
    // args is a plainObject. Put the whole args object inside data key
    return { success, code, data: args };

  }
}

function authzFlow(args: any) {
  if (args === true) {
    return {success: true};
  }
  if (!args) {
    return {
      success: false,
      code: 403
    };
  }

  return {success: (args.success && true ) || false, code: args.code || (!args.success && 403) || 200, message: args.message, headers: args.headers, data: args.data};
}
