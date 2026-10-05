import { describe, expect, it } from '@jest/globals';

import { ConflictError, NotFoundError, ValidationError } from '../../src/errors.js';
import { withDbErrorTranslation } from '../../src/repositories/db-errors.js';

/** Ошибка драйвера pg: код лежит во вложенном original/parent. */
function pgError(code: string, nesting: 'original' | 'parent' | 'direct' = 'original'): Error {
  const error = new Error('pg error') as Error & Record<string, unknown>;
  if (nesting === 'direct') error.code = code;
  else error[nesting] = Object.assign(new Error('inner'), { code });
  return error;
}

const CONTEXT = { unique: 'Серийный номер уже есть', missing: 'Оборудование не найдено' };

async function capture(action: () => Promise<never>): Promise<unknown> {
  try {
    await action();
  } catch (err) {
    return err;
  }
  throw new Error('ожидалась ошибка');
}

describe('withDbErrorTranslation', () => {
  it('нарушение уникальности становится ConflictError с контекстом', async () => {
    const err = await capture(() =>
      withDbErrorTranslation(CONTEXT, async () => {
        throw pgError('23505');
      }),
    );

    expect(err).toBeInstanceOf(ConflictError);
    expect((err as ConflictError).message).toBe('Серийный номер уже есть');
    expect((err as ConflictError).status).toBe(409);
  });

  it('нарушение внешнего ключа становится NotFoundError', async () => {
    const err = await capture(() =>
      withDbErrorTranslation(CONTEXT, async () => {
        throw pgError('23503', 'parent');
      }),
    );

    expect(err).toBeInstanceOf(NotFoundError);
    expect((err as NotFoundError).message).toBe('Оборудование не найдено');
  });

  it('код читается и с верхнего уровня', async () => {
    const err = await capture(() =>
      withDbErrorTranslation(CONTEXT, async () => {
        throw pgError('23505', 'direct');
      }),
    );

    expect(err).toBeInstanceOf(ConflictError);
  });

  it('ограничение RESTRICT даёт ConflictError с дефолтным текстом', async () => {
    const err = await capture(() =>
      withDbErrorTranslation({}, async () => {
        throw pgError('23001');
      }),
    );

    expect(err).toBeInstanceOf(ConflictError);
    expect((err as ConflictError).message).toContain('используется в других данных');
  });

  it('нарушение CHECK даёт ValidationError с деталями', async () => {
    const err = await capture(() =>
      withDbErrorTranslation(CONTEXT, async () => {
        throw pgError('23514');
      }),
    );

    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).details).toEqual([
      { field: 'value', message: 'Значение нарушает ограничение схемы' },
    ]);
  });

  it('приложенные ошибки не переводятся', async () => {
    const original = new ConflictError('Уже есть');
    const err = await capture(() =>
      withDbErrorTranslation(CONTEXT, async () => {
        throw original;
      }),
    );

    expect(err).toBe(original);
  });

  it('неизвестная ошибка пробрасывается как есть', async () => {
    const original = new Error('таймаут соединения');
    const err = await capture(() =>
      withDbErrorTranslation(CONTEXT, async () => {
        throw original;
      }),
    );

    expect(err).toBe(original);
  });

  it('успешное действие возвращает результат', async () => {
    const result = await withDbErrorTranslation(CONTEXT, async () => 'готово');

    expect(result).toBe('готово');
  });
});