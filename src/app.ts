import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import type { Express, Request, Response } from 'express';
import helmet from 'helmet';

import { config } from './config.js';
import { NotFoundError } from './errors.js';
import { contextMiddleware } from './lib/context.js';
import { httpLogger } from './lib/http-logger.js';
import { metricsContentType, renderMetrics } from './lib/metrics.js';
import { errorHandler } from './middleware/error-handler.js';
import { httpMetrics } from './middleware/metrics.js';
import { rateLimiter } from './middleware/rate-limit.js';
import type { Storage } from './repositories/index.js';
import { createApiRouter } from './routes/api.js';
import { createHealthRouter } from './routes/health.js';

export function createApp(storage: Storage): Express {
  const app = express();

  // За nginx ровно один обратный прокси: X-Forwarded-For и X-Forwarded-Proto
  // от него считаются доверенными, поэтому req.ip — реальный адрес клиента.
  app.set('trust proxy', config.TRUST_PROXY_HOPS);

  app.use(httpLogger);
  app.use(contextMiddleware);
  app.use(httpMetrics());

  app.use(helmet());
  app.use(
    cors({
      origin: config.CORS_ORIGINS,
      methods: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true,
    }),
  );
  app.use(cookieParser());

  app.use('/api', rateLimiter());

  app.use(express.json({ limit: config.BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: config.BODY_LIMIT }));

  // Метрики отдаются без токена и вне лимита частоты: их собирает система
  // мониторинга, а не пользователь. Доступ снаружи закрывает nginx.
  app.get('/metrics', (_req, res, next) => {
    renderMetrics()
      .then((body) => {
        res.set('Content-Type', metricsContentType()).send(body);
      })
      .catch(next);
  });

  app.use('/api/health', createHealthRouter(storage));
  app.use('/api', createApiRouter(storage));

  app.use((req: Request, _res: Response, next) => next(new NotFoundError('Эндпоинт не найден')));

  app.use(errorHandler);

  return app;
}