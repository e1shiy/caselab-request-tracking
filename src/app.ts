import cors from 'cors';
import express from 'express';
import type { Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';

import { config } from './config.js';
import { NotFoundError } from './errors.js';
import { contextMiddleware } from './lib/context.js';
import { httpLogger } from './lib/http-logger.js';
import { errorHandler } from './middleware/error-handler.js';

export const app = express();

app.use(httpLogger);
app.use(contextMiddleware);

app.use(helmet());
app.use(cors({ origin: config.ALLOWED_ORIGIN }));

app.use(rateLimit({ windowMs: 60_000, limit: 100 }));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.use((req, _res, next) => next(new NotFoundError('Эндпоинт')));

app.use(errorHandler);
