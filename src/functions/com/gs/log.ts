/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import Pino from 'pino';
import { childLogger } from '../../../app';

export default function(obj: {level: Pino.Level, data: any}) {
    childLogger[obj.level]({"module": "com.gs.log"}, obj.data);
}
