import { randomUUID } from 'node:crypto';

import { pinoHttp, type Options } from 'pino-http';

import { logger } from './logger.js';

// Healthcheck'и и сбор метрик идут каждые несколько секунд: в access-логе они
// только мешают. Недоступность базы фиксируется отдельным warn-сообщением
// из /api/health/ready.
const QUIET_PATHS = ['/api/health', '/metrics'];

function isQuietPath(url: string): boolean {
  return QUIET_PATHS.some((path) => url === path || url.startsWith(`${path}/`));
}

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
    ignore: (req) => isQuietPath(req.url ?? ''),
  },
};

export const httpLogger = pinoHttp(options);