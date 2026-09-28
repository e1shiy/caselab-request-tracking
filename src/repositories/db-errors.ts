import { ConflictError, NotFoundError, ValidationError } from '../errors.js';
import type { AppError } from '../errors.js';

const PG_ERROR_CODES = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  RESTRICT_VIOLATION: '23001',
  CHECK_VIOLATION: '23514',
} as const;

function pgErrorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const parent = (err as { parent?: unknown }).parent;
  if (typeof parent === 'object' && parent !== null) {
    const code = (parent as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  const original = (err as { original?: unknown }).original;
  if (typeof original === 'object' && original !== null) {
    const code = (original as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  const direct = (err as { code?: unknown }).code;
  return typeof direct === 'string' ? direct : undefined;
}

function isAppError(err: unknown): err is AppError {
  return typeof err === 'object' && err !== null && (err as AppError).isOperational === true;
}

function translateDatabaseError(err: unknown, context: {
  unique?: string;
  missing?: string;
  conflict?: string;
}): unknown {
  if (isAppError(err)) return err;

  switch (pgErrorCode(err)) {
    case PG_ERROR_CODES.UNIQUE_VIOLATION:
      return new ConflictError(context.unique ?? 'Запись с такими данными уже существует', { cause: err });
    case PG_ERROR_CODES.FOREIGN_KEY_VIOLATION:
      return new NotFoundError(context.missing ?? 'Ссылаемая запись не найдена', { cause: err });
    case PG_ERROR_CODES.RESTRICT_VIOLATION:
      return new ConflictError(context.conflict ?? 'Запись используется в других данных', { cause: err });
    case PG_ERROR_CODES.CHECK_VIOLATION:
      return new ValidationError([{ field: 'value', message: 'Значение нарушает ограничение схемы' }]);
    default:
      return err;
  }
}

export async function withDbErrorTranslation<T>(context: Parameters<typeof translateDatabaseError>[1], action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (err) {
    throw translateDatabaseError(err, context);
  }
}
