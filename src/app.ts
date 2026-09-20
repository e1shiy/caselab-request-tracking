import cors from 'cors';
import express from 'express';
import type { Express, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';

import { config } from './config.js';
import { NotFoundError } from './errors.js';
import { contextMiddleware } from './lib/context.js';
import { httpLogger } from './lib/http-logger.js';
import { errorHandler } from './middleware/error-handler.js';
import type { Storage } from './repositories/index.js';
import { createApiRouter } from './routes/api.js';

export function createApp(storage: Storage): Express {
  const app = express();

  app.use(httpLogger);
  app.use(contextMiddleware);

  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGINS }));

  app.use(
    '/api',
    rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      limit: config.RATE_LIMIT_MAX,
    }),
  );

  app.use(express.json({ limit: config.BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: config.BODY_LIMIT }));

  app.use('/api', createApiRouter(storage));

  app.use((req: Request, _res: Response, next) => next(new NotFoundError('Эндпоинт не найден')));

  app.use(errorHandler);

  return app;
}