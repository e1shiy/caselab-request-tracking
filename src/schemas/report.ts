import { z } from 'zod';

import { REQUEST_PRIORITIES, REQUEST_STATUSES } from '../domain/request.js';
import { emptyAsUndefined, limitSchema, optionalDateFilter } from './common.js';

export const equipmentLoadQuerySchema = z
  .object({
    dateFrom: optionalDateFilter('dateFrom'),
    dateTo: optionalDateFilter('dateTo'),
    siteId: emptyAsUndefined(z.string().uuid('Некорректный идентификатор площадки').optional()),
    status: emptyAsUndefined(z.enum(REQUEST_STATUSES, { message: 'Недопустимый статус' }).optional()),
    priority: emptyAsUndefined(z.enum(REQUEST_PRIORITIES, { message: 'Недопустимый приоритет' }).optional()),
    limit: limitSchema,
  })
  .refine(
    (value) => value.dateFrom === undefined || value.dateTo === undefined || value.dateFrom <= value.dateTo,
    { message: 'dateFrom не может быть позже dateTo', path: ['dateFrom'] },
  );

export type EquipmentLoadQuery = z.infer<typeof equipmentLoadQuerySchema>;
