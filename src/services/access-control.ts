import type { AuthUser, UserRole } from '../domain/user.js';
import { ForbiddenError } from '../errors.js';

interface AssigneeLike {
  technicianId: string;
}

export const REQUEST_WRITE_ROLES: readonly UserRole[] = ['technician', 'admin'];
export const EQUIPMENT_MANAGE_ROLES: readonly UserRole[] = ['admin'];

export function hasRole(user: AuthUser, allowed: readonly UserRole[]): boolean {
  return allowed.includes(user.role);
}

export function isAssignedTo(user: AuthUser, assignees: readonly AssigneeLike[]): boolean {
  return user.technicianId !== null && assignees.some(({ technicianId }) => technicianId === user.technicianId);
}

export function assertCanEditRequest(user: AuthUser, assignees: readonly AssigneeLike[]): void {
  if (user.role === 'admin') return;

  if (user.role !== 'technician') {
    throw new ForbiddenError('Изменять заявки может только техник или администратор');
  }

  if (!isAssignedTo(user, assignees)) {
    throw new ForbiddenError('Техник может изменять только заявки, на которые он назначен');
  }
}