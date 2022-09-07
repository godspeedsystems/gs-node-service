/*
* You are allowed to study this software for learning and local * development purposes only. Any other use without explicit permission by Mindgrep, is prohibited.
* © 2022 Mindgrep Technologies Pvt Ltd
*/
import Pino from 'pino';
import { logger } from '../../../core/logger';
const child_logger = logger.child({module: 'com.gs.log'});

export default function(obj: {level: Pino.Level, data: any}) {
    child_logger[obj.level](obj.data);
}
