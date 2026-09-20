import { z } from 'zod';

import { EQUIPMENT_STATUSES, EQUIPMENT_TYPES } from '../domain/equipment.js';
import { REQUEST_PRIORITIES, REQUEST_STATUSES } from '../domain/request.js';

export const idParamsSchema = z.object({ id: z.string().uuid('Некорректный идентификатор') });

export const pageSchema = z.coerce.number().int().min(1, 'page должен быть не меньше 1').default(1);
export const limitSchema = z.coerce
  .number()
  .int()
  .min(1, 'limit должен быть не меньше 1')
  .max(100, 'limit не может превышать 100')
  .default(20);

export interface Sort {
  field: string;
  order: 'asc' | 'desc';
}

export function sortSchema(fields: readonly string[]): z.ZodType<Sort> {
  return z
    .string()
    .refine(
      (value) => {
        const field = value.startsWith('-') ? value.slice(1) : value;
        return fields.includes(field);
      },
      { message: `Допустимые поля сортировки: ${fields.join(', ')}` },
    )
    .transform((value): Sort =>
      value.startsWith('-')
        ? { field: value.slice(1), order: 'desc' }
        : { field: value, order: 'asc' },
    );
}

export const equipmentStatusFilterSchema = z.enum(EQUIPMENT_STATUSES).optional();
export const equipmentTypeFilterSchema = z.enum(EQUIPMENT_TYPES).optional();
export const requestStatusFilterSchema = z.enum(REQUEST_STATUSES).optional();
export const requestPriorityFilterSchema = z.enum(REQUEST_PRIORITIES).optional();