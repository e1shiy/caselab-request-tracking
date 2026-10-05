import type { NextFunction, Request, Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

import { config } from '../config.js';
import { RateLimitError } from '../errors.js';

const REFUSAL: (req: Request, res: Response, next: NextFunction) => void = (
  _req: Request,
  _res: Response,
  next: NextFunction,
) => {
  next(new RateLimitError());
};

export function rateLimiter(): ReturnType<typeof rateLimit> {
  return rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    limit: config.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    handler: REFUSAL,
  });
}

// Счётчик ведётся по паре «IP + email»: подбор пароля к одному аккаунту и
// перебор разных аккаунтов с одного адреса ограничиваются независимо.
export function loginRateLimiter(): ReturnType<typeof rateLimit> {
  return rateLimit({
    windowMs: config.LOGIN_RATE_LIMIT_WINDOW_MS,
    limit: config.LOGIN_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      const body = req.body as { email?: unknown } | undefined;
      const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
      return `${ipKeyGenerator(req.ip ?? '')}:${email}`;
    },
    handler: REFUSAL,
  });
}