import { z } from 'zod';

import { EQUIPMENT_STATUSES, EQUIPMENT_TYPES } from '../domain/equipment.js';
import {
  equipmentStatusFilterSchema,
  equipmentTypeFilterSchema,
  idParamsSchema,
  isoDateSchema,
  limitSchema,
  optionalDateFilter,
  pageSchema,
  sortSchema,
} from './common.js';

const today = (): string => new Date().toISOString().slice(0, 10);

export const locationSchema = z.object({
  lat: z.coerce.number().min(-90, 'Широта от -90 до 90').max(90, 'Широта от -90 до 90'),
  lon: z.coerce.number().min(-180, 'Долгота от -180 до 180').max(180, 'Долгота от -180 до 180'),
});

export const installedAtSchema = isoDateSchema('Дата установки должна быть в формате YYYY-MM-DD').refine(
  (value) => value <= today(),
  { message: 'Дата установки не может быть в будущем' },
);

export const equipmentCreateSchema = z.object({
  name: z.string().trim().min(3, 'Название должно содержать не менее 3 символов').max(100, 'Название не более 100 символов'),
  type: z.enum(EQUIPMENT_TYPES, { message: 'Недопустимый тип оборудования' }),
  serialNumber: z.string().trim().min(1, 'Серийный номер обязателен').max(100, 'Серийный номер не более 100 символов'),
  location: locationSchema,
  status: z.enum(EQUIPMENT_STATUSES, { message: 'Недопустимый статус' }).default('operational'),
  installedAt: installedAtSchema,
});

export const equipmentUpdateSchema = z
  .object({
    name: z.string().trim().min(3, 'Название должно содержать не менее 3 символов').max(100, 'Название не более 100 символов'),
    type: z.enum(EQUIPMENT_TYPES, { message: 'Недопустимый тип оборудования' }),
    serialNumber: z.string().trim().min(1, 'Серийный номер обязателен').max(100, 'Серийный номер не более 100 символов'),
    location: locationSchema,
    status: z.enum(EQUIPMENT_STATUSES, { message: 'Недопустимый статус' }),
    installedAt: installedAtSchema,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Запрос не содержит полей для обновления' });

const EQUIPMENT_SORT_FIELDS = ['name', 'type', 'status', 'serialNumber', 'installedAt', 'createdAt'] as const;

export const equipmentListQuerySchema = z
  .object({
    status: equipmentStatusFilterSchema,
    type: equipmentTypeFilterSchema,
    installedFrom: optionalDateFilter('installedFrom'),
    installedTo: optionalDateFilter('installedTo'),
    sort: sortSchema(EQUIPMENT_SORT_FIELDS),
    page: pageSchema,
    limit: limitSchema,
  })
  .refine(
    (value) =>
      value.installedFrom === undefined ||
      value.installedTo === undefined ||
      value.installedFrom <= value.installedTo,
    { message: 'installedFrom не может быть позже installedTo', path: ['installedFrom'] },
  );

export type EquipmentCreateInput = z.infer<typeof equipmentCreateSchema>;
export type EquipmentUpdateInput = z.infer<typeof equipmentUpdateSchema>;
export type EquipmentListQuery = z.infer<typeof equipmentListQuerySchema>;
export type IdParams = z.infer<typeof idParamsSchema>;