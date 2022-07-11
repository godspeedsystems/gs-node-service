import Pino from 'pino';
import { logger } from '../../../core/logger';
const child_logger = logger.child({module: 'com.gs.log'});

export default function(obj: {level: Pino.Level, data: any}) {
    child_logger[obj.level](obj.data);
}
