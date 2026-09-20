export interface AppErrorOptions {
  status?: number;
  code?: string;
  details?: unknown;
  cause?: unknown;
}

const DEFAULT_CODE = 'INTERNAL_ERROR';

export class AppError extends Error {
  readonly isOperational = true;
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.status = options.status ?? 500;
    this.code = options.code ?? DEFAULT_CODE;
    this.details = options.details;
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super('Некорректные данные запроса', { status: 422, code: 'VALIDATION_ERROR', details });
  }
}

export class NotFoundError extends AppError {
  constructor(what = 'Ресурс') {
    super(`${what} не найден`, { status: 404, code: 'NOT_FOUND' });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, 'status' | 'code'> = {}) {
    super(message, { ...options, status: 409, code: 'CONFLICT' });
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, 'status' | 'code'> = {}) {
    super(message, { ...options, status: 400, code: 'BAD_REQUEST' });
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, 'status' | 'code'> = {}) {
    super(message, { ...options, status: 502, code: 'EXTERNAL_API_ERROR' });
  }
}