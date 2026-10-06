import { describe, expect, it, jest } from '@jest/globals';
import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';

import { ConflictError, NotFoundError, ValidationError } from '../../src/errors.js';
import { errorHandler } from '../../src/middleware/error-handler.js';

interface Harness {
  err: unknown;
  env: string;
  headersSent?: boolean;
  logged?: 'warn' | 'error';
}

function invoke(err: unknown, env = 'test'): { status: number; body: Record<string, unknown>; harness: Harness } {
  const harness: Harness = { err, env };
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headersSent: harness.headersSent ?? false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  const req = {
    id: 'req-1',
    app: { get: (key: string) => (key === 'env' ? harness.env : undefined) },
    log: {
      warn: () => {
        harness.logged = 'warn';
      },
      error: () => {
        harness.logged = 'error';
      },
    },
  };

  (errorHandler as ErrorRequestHandler)(err, req as unknown as Request, res as unknown as Response, () => {});

  return { status: res.statusCode, body: res.body as Record<string, unknown>, harness };
}

function errorBody(body: Record<string, unknown>): Record<string, unknown> {
  return body.error as Record<string, unknown>;
}

describe('errorHandler', () => {
  it('операционная ошибка сохраняет статус, код и сообщение', () => {
    const { status, body, harness } = invoke(
      new ValidationError([{ field: 'email', message: 'Некорректный адрес' }]),
    );

    expect(status).toBe(422);
    expect(errorBody(body)).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Некорректные данные запроса',
      requestId: 'req-1',
    });
    expect(errorBody(body).details).toEqual([{ field: 'email', message: 'Некорректный адрес' }]);
    expect(harness.logged).toBe('warn');
  });

  it('ошибка без details не добавляет поле', () => {
    const { body } = invoke(new NotFoundError());

    expect('details' in errorBody(body)).toBe(false);
  });

  it('слишком большое тело превращается в 413', () => {
    const { status, body } = invoke(Object.assign(new Error('request entity too large'), { type: 'entity.too.large' }));

    expect(status).toBe(500);
    expect(errorBody(body).code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('битый JSON превращается в INVALID_JSON', () => {
    const { body } = invoke(Object.assign(new SyntaxError('Unexpected token'), { type: 'entity.parse.failed' }));

    expect(errorBody(body)).toMatchObject({ code: 'INVALID_JSON', message: 'Некорректный JSON в теле запроса' });
  });

  it('неизвестная ошибка даёт 500 и логируется как error', () => {
    const { status, body, harness } = invoke(new Error('boom'));

    expect(status).toBe(500);
    expect(errorBody(body)).toMatchObject({ code: 'INTERNAL_ERROR', message: 'boom' });
    expect(harness.logged).toBe('error');
  });

  it('в production внутренняя ошибка не выдаёт детали наружу', () => {
    const { status, body } = invoke(new Error('connection string postgres://secret'), 'production');

    expect(status).toBe(500);
    expect(errorBody(body).message).toBe('Внутренняя ошибка сервера');
  });

  it('в production операционная ошибка остаётся информативной', () => {
    const { body } = invoke(new ConflictError('Серийный номер занят'), 'production');

    expect(errorBody(body).message).toBe('Серийный номер занят');
  });

  it('код драйвера пробрасывается в ответ', () => {
    const { status, body } = invoke(Object.assign(new Error('deadlock'), { code: '40001' }));

    expect(status).toBe(500);
    expect(errorBody(body).code).toBe('40001');
  });

  it('statusCode из ошибки используется как статус', () => {
    const { status } = invoke(Object.assign(new Error('teapot'), { statusCode: 418 }));

    expect(status).toBe(418);
  });

  it('после отправки заголовков ошибка уходит дальше по цепочке', () => {
    const harness: Harness = { err: new Error('late'), env: 'test' };
    const next = jest.fn<(err: unknown) => void>();
    const res = {
      headersSent: true,
      status: () => res,
      json: () => res,
    };
    const req = { id: 'req-2', app: { get: () => 'test' } };

    (errorHandler as ErrorRequestHandler)(
      harness.err,
      req as unknown as Request,
      res as unknown as Response,
      next as unknown as NextFunction,
    );

    expect(next).toHaveBeenCalledWith(harness.err);
  });
});