import { GSContext } from "../../../core/interfaces";

/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
export default function (...args: any[]) {
  if (args.length == 2) {
    return args[1];
  } else if (args.length == 1) {
    return args[0];
  }
  // remove ctx
  args.pop();
  return args;
}