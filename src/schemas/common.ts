import { z } from 'zod';

import { EQUIPMENT_STATUSES, EQUIPMENT_TYPES } from '../domain/equipment.js';
import { REQUEST_PRIORITIES, REQUEST_STATUSES } from '../domain/request.js';

export const idParamsSchema = z.object({ id: z.string().uuid('Некорректный идентификатор') });

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function emptyToUndefined(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

export function emptyAsUndefined<T extends z.ZodType>(schema: T) {
  return z.preprocess(emptyToUndefined, schema);
}

export function isoDateSchema(message: string) {
  return z
    .string()
    .refine((value) => ISO_DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value)), { message });
}

export function optionalDateFilter(param: string) {
  return emptyAsUndefined(isoDateSchema(`${param} должен быть в формате YYYY-MM-DD`).optional());
}

export const MAX_LIMIT = 100;
export const MAX_OFFSET = 10000;

export const pageSchema = emptyAsUndefined(
  z.coerce.number().int('page должен быть целым числом').min(1, 'page должен быть не меньше 1').default(1),
);
export const limitSchema = emptyAsUndefined(
  z.coerce
    .number()
    .int('limit должен быть целым числом')
    .min(1, 'limit должен быть не меньше 1')
    .max(MAX_LIMIT, `limit не может превышать ${MAX_LIMIT}`)
    .default(20),
);
export const offsetSchema = emptyAsUndefined(
  z.coerce
    .number()
    .int('offset должен быть целым числом')
    .min(0, 'offset не может быть отрицательным')
    .max(MAX_OFFSET, `offset не может превышать ${MAX_OFFSET}`)
    .optional(),
);

export const PAGINATION_FIELDS = ['page', 'limit', 'offset'] as const;

export function boundOffset(
  value: { page: number; limit: number; offset?: number },
  ctx: z.RefinementCtx,
): void {
  if (value.offset !== undefined) return;
  const offset = (value.page - 1) * value.limit;
  if (offset > MAX_OFFSET) {
    ctx.addIssue({
      code: 'custom',
      path: ['page'],
      message: `Смещение выборки не может превышать ${MAX_OFFSET}`,
    });
  }
}

export interface Sort {
  field: string;
  order: 'asc' | 'desc';
}

export function sortSchema(fields: readonly string[]): z.ZodType<Sort | undefined> {
  const parsed = z
    .string()
    .refine(
      (value) => {
        const field = value.startsWith('-') ? value.slice(1) : value;
        return fields.includes(field);
      },
      { message: `Допустимые поля сортировки: ${fields.join(', ')}` },
    )
    .transform((value): Sort =>
      value.startsWith('-') ? { field: value.slice(1), order: 'desc' } : { field: value, order: 'asc' },
    );

  return emptyAsUndefined(parsed.optional());
}

export const equipmentStatusFilterSchema = emptyAsUndefined(z.enum(EQUIPMENT_STATUSES).optional());
export const equipmentTypeFilterSchema = emptyAsUndefined(z.enum(EQUIPMENT_TYPES).optional());
export const requestStatusFilterSchema = emptyAsUndefined(z.enum(REQUEST_STATUSES).optional());
export const requestPriorityFilterSchema = emptyAsUndefined(z.enum(REQUEST_PRIORITIES).optional());
export type IdParams = z.infer<typeof idParamsSchema>;
