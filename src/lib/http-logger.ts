import { randomUUID } from 'node:crypto';

import { pinoHttp, type Options } from 'pino-http';

import { logger } from './logger.js';

const options: Options = {
  logger,
  genReqId(req, res) {
    const existing = req.headers['x-request-id'];
    if (typeof existing === 'string' && existing.length > 0) {
      res.setHeader('X-Request-Id', existing);
      return existing;
    }
    const id = randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customLogLevel(req, res, err) {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  autoLogging: {
    ignore: (req) => req.url === '/health',
  },
};

export const httpLogger = pinoHttp(options);