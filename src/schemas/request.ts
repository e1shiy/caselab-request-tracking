import { z } from 'zod';

import { REQUEST_PRIORITIES, REQUEST_STATUSES } from '../domain/request.js';
import { ASSIGNEE_ROLES } from '../domain/technician.js';
import {
  emptyAsUndefined,
  idParamsSchema,
  boundOffset,
  limitSchema,
  offsetSchema,
  optionalDateFilter,
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
  author: z
    .string()
    .trim()
    .min(2, 'Автор должен содержать не менее 2 символов')
    .max(120, 'Автор не более 120 символов')
    .optional(),
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
  comment: z.string().trim().max(500, 'Комментарий не более 500 символов').optional(),
  changedBy: z.string().trim().min(2, 'Имя должно содержать не менее 2 символов').max(120).optional(),
});

const requestAssigneeItemSchema = z.object({
  technicianId: z.string().uuid('Некорректный идентификатор специалиста'),
  role: z.enum(ASSIGNEE_ROLES, { message: 'Допустимая роль: lead или member' }),
  plannedHours: z
    .number({ message: 'Планируемые часы должны быть числом' })
    .nonnegative('Планируемые часы не могут быть отрицательными')
    .max(1000, 'Планируемые часы не могут превышать 1000')
    .optional(),
});

export const requestAssigneesSchema = z
  .object({
    assignees: z
      .array(requestAssigneeItemSchema)
      .min(1, 'Бригада не может быть пустой')
      .max(20, 'В бригаде не более 20 специалистов'),
  })
  .superRefine((value, ctx) => {
    const unique = new Set(value.assignees.map((assignee) => assignee.technicianId));
    if (unique.size !== value.assignees.length) {
      ctx.addIssue({ code: 'custom', path: ['assignees'], message: 'Специалист не может быть назначен дважды' });
    }
    if (value.assignees.filter((assignee) => assignee.role === 'lead').length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['assignees'],
        message: 'В бригаде должен быть ровно один ведущий (lead)',
      });
    }
  });

export const requestAssigneeParamsSchema = z.object({
  id: idParamsSchema.shape.id,
  technicianId: z.string().uuid('Некорректный идентификатор специалиста'),
});

const REQUEST_SORT_FIELDS = ['priority', 'status', 'plannedAt', 'createdAt', 'updatedAt'] as const;

export const requestListQuerySchema = z
  .object({
    status: requestStatusFilterSchema,
    priority: requestPriorityFilterSchema,
    equipmentId: emptyAsUndefined(z.string().uuid('Некорректный идентификатор оборудования').optional()),
    dateFrom: optionalDateFilter('dateFrom'),
    dateTo: optionalDateFilter('dateTo'),
    sort: sortSchema(REQUEST_SORT_FIELDS),
    page: pageSchema,
    limit: limitSchema,
    offset: offsetSchema,
  })
  .superRefine(boundOffset)
  .refine(
    (value) => value.dateFrom === undefined || value.dateTo === undefined || value.dateFrom <= value.dateTo,
    { message: 'dateFrom не может быть позже dateTo', path: ['dateFrom'] },
  );

export type RequestCreateInput = z.infer<typeof requestCreateSchema>;
export type RequestUpdateInput = z.infer<typeof requestUpdateSchema>;
export type RequestListQuery = z.infer<typeof requestListQuerySchema>;
export type RequestStatusBody = z.infer<typeof requestStatusSchema>;
export type RequestAssigneesBody = z.infer<typeof requestAssigneesSchema>;
export type IdParams = z.infer<typeof idParamsSchema>;
export type RequestAssigneeParams = z.infer<typeof requestAssigneeParamsSchema>;