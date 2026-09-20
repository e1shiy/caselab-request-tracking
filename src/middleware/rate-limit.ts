import { rateLimit } from 'express-rate-limit';
import type { NextFunction, Request, Response } from 'express';

import { config } from '../config.js';
import { RateLimitError } from '../errors.js';

export function rateLimiter(): ReturnType<typeof rateLimit> {
  return rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    limit: config.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, _res: Response, next: NextFunction) => {
      next(new RateLimitError());
    },
  });
}