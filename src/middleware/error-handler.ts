import type { ErrorRequestHandler } from 'express';

import { logger } from '../lib/logger.js';

function isAppError(err: unknown): err is import('../errors.js').AppError {
  return err instanceof Error && (err as { isOperational?: boolean }).isOperational === true;
}

function errStatus(err: unknown): number {
  const candidate = (err as { status?: number; statusCode?: number } | undefined)?.status;
  if (typeof candidate === 'number' && Number.isInteger(candidate)) return candidate;
  const candidateCode = (err as { statusCode?: number } | undefined)?.statusCode;
  return typeof candidateCode === 'number' && Number.isInteger(candidateCode) ? candidateCode : 500;
}

type NormalizedError = {
  status: number;
  code: string;
  message: string;
  details: unknown;
};

function normalizeError(err: unknown): NormalizedError {
  if (isAppError(err)) {
    return { status: err.status, code: err.code, message: err.message, details: err.details };
  }

  const type = (err as { type?: string } | undefined)?.type;
  const rawCode = (err as { code?: string } | undefined)?.code;
  const code = typeof rawCode === 'string' && rawCode.length > 0 ? rawCode : 'INTERNAL_ERROR';
  const status = errStatus(err);

  if (type === 'entity.too.large') {
    return {
      status,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Размер тела запроса превышает допустимый лимит',
      details: undefined,
    };
  }

  if (type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return { status, code: 'INVALID_JSON', message: 'Некорректный JSON в теле запроса', details: undefined };
  }

  return { status, code, message: err instanceof Error ? err.message : 'Неизвестная ошибка', details: undefined };
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const { status, code, message, details } = normalizeError(err);

  const log = req.log ?? logger;
  if (status >= 500) {
    log.error({ err, status, requestId: req.id }, 'request failed');
  } else {
    log.warn({ err, status, requestId: req.id }, 'request failed');
  }

  const visibleMessage =
    status >= 500 && req.app.get('env') === 'production' ? 'Внутренняя ошибка сервера' : message;

  const body: Record<string, unknown> = {
    error: {
      code,
      message: visibleMessage,
      requestId: req.id,
    },
  };

  if (details !== undefined) (body.error as Record<string, unknown>).details = details;

  res.status(status).json(body);
};