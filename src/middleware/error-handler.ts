import type { ErrorRequestHandler } from 'express';

import { logger } from '../lib/logger.js';

const PROBLEM_TYPE_BASE = 'https://example.com/problems';

function errStatus(err: unknown): number {
  const candidate = (err as { status?: number; statusCode?: number } | undefined)?.status;
  if (typeof candidate === 'number' && Number.isInteger(candidate)) return candidate;
  const candidateCode = (err as { statusCode?: number } | undefined)?.statusCode;
  return typeof candidateCode === 'number' && Number.isInteger(candidateCode) ? candidateCode : 500;
}

function errCode(err: unknown): string {
  const raw = (err as { code?: string; type?: string } | undefined)?.code
    ?? (err as { type?: string } | undefined)?.type;
  return typeof raw === 'string' && raw.length > 0 ? raw : 'internal_error';
}

function errDetails(err: unknown): unknown {
  return (err as { details?: unknown } | undefined)?.details;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const status = errStatus(err);
  const message = err instanceof Error ? err.message : 'Неизвестная ошибка';

  const log = req.log ?? logger;
  if (status >= 500) {
    log.error({ err, status }, 'request failed');
  } else {
    log.warn({ err, status }, 'request failed');
  }

  const body: Record<string, unknown> = {
    type: `${PROBLEM_TYPE_BASE}/${errCode(err)}`,
    title: status >= 500 ? 'Внутренняя ошибка сервера' : message,
    status,
    instance: req.originalUrl,
    requestId: req.id,
  };

  const details = errDetails(err);
  if (details !== undefined) body.errors = details;

  res.status(status).type('application/problem+json').json(body);
};