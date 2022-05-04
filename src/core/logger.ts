import { debug } from 'console';
import Pino from 'pino'

const logger: Pino.Logger = Pino({
    name: 'GS-logger'
  })

export { logger };
