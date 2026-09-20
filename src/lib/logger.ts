import pino from 'pino';

import { config } from '../config.js';

const isProduction = config.NODE_ENV === 'production';

export const logger = pino({
  level: config.LOG_LEVEL,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
    remove: true,
  },
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
      },
});