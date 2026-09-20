import { z } from 'zod';

import { REQUEST_PRIORITIES, REQUEST_STATUSES } from '../domain/request.js';
import {
  idParamsSchema,
  limitSchema,
  pageSchema,
  requestPriorityFilterSchema,
  requestStatusFilterSchema,
  sortSchema,
} from './common.js';

export const requestCreateSchema = z.object({
  equipmentId: z.string().uuid('Некорректный идентификатор оборудования'),
  title: z
    .string()
    .trim()
    .min(5, 'Название должно содержать не менее 5 символов')
    .max(120, 'Название не более 120 символов'),
  description: z.string().trim().max(2000, 'Описание не более 2000 символов').optional(),
  priority: z.enum(REQUEST_PRIORITIES, { message: 'Недопустимый приоритет' }).default('medium'),
  plannedAt: z.iso.datetime({ message: 'Дата планирования должна быть в формате ISO-8601' }).optional(),
});

export const requestUpdateSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(5, 'Название должно содержать не менее 5 символов')
      .max(120, 'Название не более 120 символов'),
    description: z.string().trim().max(2000, 'Описание не более 2000 символов'),
    priority: z.enum(REQUEST_PRIORITIES, { message: 'Недопустимый приоритет' }),
    plannedAt: z.iso.datetime({ message: 'Дата планирования должна быть в формате ISO-8601' }).nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Запрос не содержит полей для обновления' });

export const requestStatusSchema = z.object({
  status: z.enum(REQUEST_STATUSES, { message: 'Недопустимый статус' }),
});

const REQUEST_SORT_FIELDS = ['priority', 'status', 'plannedAt', 'createdAt', 'updatedAt'] as const;

export const requestListQuerySchema = z
  .object({
    status: requestStatusFilterSchema,
    priority: requestPriorityFilterSchema,
    equipmentId: z.string().uuid('Некорректный идентификатор оборудования').optional(),
    dateFrom: z
      .string()
      .refine(
        (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)),
        { message: 'dateFrom должен быть в формате YYYY-MM-DD' },
      )
      .optional(),
    dateTo: z
      .string()
      .refine(
        (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)),
        { message: 'dateTo должен быть в формате YYYY-MM-DD' },
      )
      .optional(),
    sort: sortSchema(REQUEST_SORT_FIELDS).optional(),
    page: pageSchema,
    limit: limitSchema,
  })
  .refine(
    (value) => value.dateFrom === undefined || value.dateTo === undefined || value.dateFrom <= value.dateTo,
    { message: 'dateFrom не может быть позже dateTo', path: ['dateFrom'] },
  );

export type RequestCreateInput = z.infer<typeof requestCreateSchema>;
export type RequestUpdateInput = z.infer<typeof requestUpdateSchema>;
export type RequestListQuery = z.infer<typeof requestListQuerySchema>;
export type RequestStatusBody = z.infer<typeof requestStatusSchema>;
export type IdParams = z.infer<typeof idParamsSchema>;