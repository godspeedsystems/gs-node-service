import cron from 'node-cron';
import { logger } from '../core/logger';
import { GSActor, GSCloudEvent } from '../core/interfaces';

export default function(route, processEvent) {
    let [schedule, timezone] = route.split('.cron.');
    logger.info('registering cron handler %s %s', schedule, timezone);
    cron.schedule(schedule, async () => {
        logger.info(`Running a job for ${route}`);
        const event = new GSCloudEvent('id', route, new Date(), 'cron',
            '1.0', {}, 'cron', new GSActor('user'),  {});

        processEvent(event);
    }, {
        timezone
    });
}