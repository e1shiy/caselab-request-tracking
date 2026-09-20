export interface AppErrorOptions {
  status?: number;
  code?: string;
  details?: unknown;
  cause?: unknown;
}

export class AppError extends Error {
  readonly isOperational = true;
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.status = options.status ?? 500;
    this.code = options.code ?? 'internal_error';
    this.details = options.details;
  }
}

export class NotFoundError extends AppError {
  constructor(what = 'Ресурс') {
    super(`${what} не найден`, { status: 404, code: 'not_found' });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, 'status' | 'code'> = {}) {
    super(message, { ...options, status: 409, code: 'conflict' });
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super('Ошибка валидации', { status: 400, code: 'validation_failed', details });
  }
}