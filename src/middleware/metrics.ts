import type { NextFunction, Request, Response } from 'express';

import { observeRequest, requestFinished, requestStarted } from '../lib/metrics.js';

const UNKNOWN_ROUTE = 'unmatched';
const MAX_SEGMENTS = 6;

// Литеральный сегмент маршрута: строчные латинские буквы, цифры, дефис и
// подчёркивание. Всё остальное (UUID, номера, мусор из невалидного ввода)
// маскируется, иначе количество временных рядов росло бы вместе с потоком
// запросов. Глубина ограничена по той же причине.
const LITERAL_SEGMENT = /^[a-z][a-z0-9_-]{0,23}$/;
const METRICS_PATH = '/metrics';

function normalizePath(path: string): string {
  const segments = path.split('/').filter(Boolean);

  if (segments.length > MAX_SEGMENTS) {
    return UNKNOWN_ROUTE;
  }

  const normalized = segments.map((segment) =>
    LITERAL_SEGMENT.test(segment) ? segment : ':id',
  );

  return `/${normalized.join('/')}`;
}

function routeLabel(req: Request): string {
  const path = (req.originalUrl ?? '').split('?')[0] ?? '';

  if (path === METRICS_PATH || path.startsWith('/api/')) {
    return normalizePath(path);
  }

  return path === '/' ? '/' : UNKNOWN_ROUTE;
}

/**
 * Метрики собираются по нормализованному пути, а не по шаблону роутера:
 * `req.route` и `req.baseUrl` недоступны к моменту, когда error handler
 * пишет ответ, и шаблон получился бы неполным.
 */
export function httpMetrics() {
  return (req: Request, res: Response, next: NextFunction): void => {
    requestStarted();

    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      requestFinished();

      observeRequest({
        method: req.method,
        route: routeLabel(req),
        status: res.statusCode,
        durationSeconds: Number(process.hrtime.bigint() - startedAt) / 1e9,
      });
    });

    next();
  };
}