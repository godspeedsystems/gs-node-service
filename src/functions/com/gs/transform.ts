/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
export default function(...args:any[]) {
  const popped = args.pop();
  if (args.length == 1) {
    return args[0];
  } else if (args.length == 0) {
    return popped;
  }
  return args;
}