import { EQUIPMENT_STATUSES, EQUIPMENT_TYPES } from '../../domain/equipment.js';
import { REQUEST_PRIORITIES, REQUEST_STATUSES } from '../../domain/request.js';
import { ASSIGNEE_ROLES } from '../../domain/technician.js';
import { USER_ROLES } from '../../domain/user.js';

// Типы, которые создаёт первая миграция. user_role здесь нет: его создаёт
// миграция пользователей, уже применённые миграции не переписываются.
export const ENUM_TYPES = [
  { name: 'equipment_type', values: EQUIPMENT_TYPES },
  { name: 'equipment_status', values: EQUIPMENT_STATUSES },
  { name: 'request_priority', values: REQUEST_PRIORITIES },
  { name: 'request_status', values: REQUEST_STATUSES },
  { name: 'assignee_role', values: ASSIGNEE_ROLES },
] as const;

export const ALL_ENUM_TYPES = [...ENUM_TYPES, { name: 'user_role', values: USER_ROLES }];

export const ENUM_TYPE_NAMES = ENUM_TYPES.map((type) => type.name);