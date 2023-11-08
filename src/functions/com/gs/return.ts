import { GSStatus } from "../../../godspeed";
import { PlainObject } from "../../../types";

/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
export default function (ctx: PlainObject, args: PlainObject) {
  return {success: true, code: 200, data: args, exitWithStatus: true };
}