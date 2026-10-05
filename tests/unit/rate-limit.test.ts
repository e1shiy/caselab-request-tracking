import { afterEach, describe, expect, it } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';

import { config } from '../../src/config.js';
import { RateLimitError } from '../../src/errors.js';
import { loginRateLimiter, rateLimiter } from '../../src/middleware/rate-limit.js';

type MutableConfig = { RATE_LIMIT_MAX: number; LOGIN_RATE_LIMIT_MAX: number };
const mutableConfig = config as unknown as MutableConfig;
const originalApiLimit = config.RATE_LIMIT_MAX;
const originalLoginLimit = config.LOGIN_RATE_LIMIT_MAX;

interface StubResponse {
  statusCode: number | null;
  headers: Record<string, string>;
  payload: unknown;
}

function stubResponse(): StubResponse {
  return { statusCode: null, headers: {}, payload: undefined };
}

function call(
  middleware: ReturnType<typeof rateLimiter>,
  req: Partial<Request>,
  res: StubResponse,
): Promise<unknown> {
  return new Promise((resolve) => {
    const response = {
      setHeader: (key: string, value: string) => {
        res.headers[key.toLowerCase()] = value;
        return response;
      },
      getHeader: (key: string) => res.headers[key.toLowerCase()],
      status: (code: number) => {
        res.statusCode = code;
        return response;
      },
      json: (payload: unknown) => {
        res.payload = payload;
        resolve(payload);
        return response;
      },
      send: (payload: unknown) => {
        res.payload = payload;
        resolve(payload);
        return response;
      },
      on: () => response,
      once: () => response,
      emit: () => false,
      end: () => response,
    } as unknown as Response;

    const next: NextFunction = ((err?: unknown) => resolve(err)) as NextFunction;
    // express-rate-limit валидирует доверие к прокси через req.app и заголовки,
    // поэтому заглушке запроса нужны app.get и headers.
    const request = {
      headers: {},
      app: { get: (key: string) => (key === 'trust proxy' ? false : undefined) },
      ...req,
    };
    middleware(request as Request, response, next);
  });
}

afterEach(() => {
  mutableConfig.RATE_LIMIT_MAX = originalApiLimit;
  mutableConfig.LOGIN_RATE_LIMIT_MAX = originalLoginLimit;
});

describe('rateLimiter', () => {
  it('превышение квоты даёт RateLimitError и заголовок Retry-After', async () => {
    mutableConfig.RATE_LIMIT_MAX = 2;
    const limiter = rateLimiter();

    const first = await call(limiter, { ip: '10.0.0.1' }, stubResponse());
    const second = await call(limiter, { ip: '10.0.0.1' }, stubResponse());
    const res = stubResponse();
    const err = await call(limiter, { ip: '10.0.0.1' }, res);

    expect(first).toBeUndefined();
    expect(second).toBeUndefined();
    expect(err).toBeInstanceOf(RateLimitError);
    // Со стандартными заголовками express-rate-limit при превышении сам ставит
    // только Retry-After: код ответа и тело формирует наш обработчик ошибок.
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('разные IP не делят квоту', async () => {
    mutableConfig.RATE_LIMIT_MAX = 1;
    const limiter = rateLimiter();

    await call(limiter, { ip: '10.0.0.1' }, stubResponse());
    const err = await call(limiter, { ip: '10.0.0.2' }, stubResponse());

    expect(err).toBeUndefined();
  });
});

describe('loginRateLimiter', () => {
  it('считает квоту по паре IP + email', async () => {
    mutableConfig.LOGIN_RATE_LIMIT_MAX = 1;
    const limiter = loginRateLimiter();

    await call(limiter, { ip: '10.0.0.1', body: { email: 'User@Example.Test' } }, stubResponse());
    // Тот же IP, другой аккаунт: подбор пароля к разным аккаунтам ограничивается
    // независимо.
    const other = await call(limiter, { ip: '10.0.0.1', body: { email: 'other@example.test' } }, stubResponse());
    // Тот же аккаунт с другого IP.
    const otherIp = await call(
      limiter,
      { ip: '10.0.0.9', body: { email: ' user@example.test ' } },
      stubResponse(),
    );
    const same = await call(limiter, { ip: '10.0.0.1', body: { email: 'user@example.test' } }, stubResponse());

    expect(other).toBeUndefined();
    expect(otherIp).toBeUndefined();
    expect(same).toBeInstanceOf(RateLimitError);
  });

  it('тело без email не ломает генератор ключа', async () => {
    mutableConfig.LOGIN_RATE_LIMIT_MAX = 1;
    const limiter = loginRateLimiter();

    const first = await call(limiter, { ip: '10.0.0.1' }, stubResponse());
    const second = await call(limiter, { ip: '10.0.0.1', body: {} }, stubResponse());

    expect(first).toBeUndefined();
    expect(second).toBeInstanceOf(RateLimitError);
  });
});