import type { ErrorRequestHandler } from 'express';

import { logger } from '../lib/logger.js';

function isAppError(err: unknown): err is import('../errors.js').AppError {
  return err instanceof Error && (err as { isOperational?: boolean }).isOperational === true;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const status =
    typeof (err as { status?: number } | undefined)?.status === 'number' &&
    Number.isInteger((err as { status?: number }).status)
      ? (err as { status: number }).status
      : 500;
  const code = isAppError(err)
    ? err.code
    : typeof (err as { code?: string } | undefined)?.code === 'string' && (err as { code: string }).code.length > 0
      ? (err as { code: string }).code
      : 'INTERNAL_ERROR';
  const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
  const details = isAppError(err) ? err.details : undefined;

  const log = req.log ?? logger;
  if (status >= 500) {
    log.error({ err, status, requestId: req.id }, 'request failed');
  } else {
    log.warn({ err, status, requestId: req.id }, 'request failed');
  }

  const visibleMessage = status >= 500 && req.app.get('env') === 'production'
    ? 'Внутренняя ошибка сервера'
    : message;

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