/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
export default function(...args:any[]) {
  const popped = args.pop();
  if (args.length == 1) {
    return {success: true, code: 200, data: args[0], exitWithStatus: true };
  } else if (args.length == 0) {
    return {success: true, code: 200, data: popped, exitWithStatus: true };
  }
  return {success: true, code: 200, data: args, exitWithStatus: true };
}