import { describe, expect, it } from '@jest/globals';

import type { AuthUser } from '../../src/domain/user.js';
import { ForbiddenError } from '../../src/errors.js';
import {
  EQUIPMENT_MANAGE_ROLES,
  REQUEST_WRITE_ROLES,
  assertCanEditRequest,
  hasRole,
  isAssignedTo,
} from '../../src/services/access-control.js';

const admin: AuthUser = {
  id: 'admin-id',
  email: 'admin@example.test',
  fullName: 'Администратор',
  role: 'admin',
  technicianId: null,
};

const technician: AuthUser = {
  id: 'tech-1',
  email: 'tech@example.test',
  fullName: 'Техник',
  role: 'technician',
  technicianId: 'tech-record-1',
};

const viewer: AuthUser = {
  id: 'viewer-1',
  email: 'viewer@example.test',
  fullName: 'Наблюдатель',
  role: 'viewer',
  technicianId: null,
};

describe('hasRole', () => {
  it('администратор входит в оба списка, наблюдатель — ни в один', () => {
    expect(hasRole(admin, REQUEST_WRITE_ROLES)).toBe(true);
    expect(hasRole(admin, EQUIPMENT_MANAGE_ROLES)).toBe(true);
    expect(hasRole(viewer, REQUEST_WRITE_ROLES)).toBe(false);
    expect(hasRole(viewer, EQUIPMENT_MANAGE_ROLES)).toBe(false);
  });

  it('техник пишет заявки, но не управляет оборудованием', () => {
    expect(hasRole(technician, REQUEST_WRITE_ROLES)).toBe(true);
    expect(hasRole(technician, EQUIPMENT_MANAGE_ROLES)).toBe(false);
  });
});

describe('isAssignedTo', () => {
  const crew = [{ technicianId: 'tech-record-1' }, { technicianId: 'tech-record-2' }];

  it('назначенный техник узнаёт себя в бригаде', () => {
    expect(isAssignedTo(technician, crew)).toBe(true);
  });

  it('не назначенный — нет', () => {
    expect(isAssignedTo({ ...technician, technicianId: 'tech-record-9' }, crew)).toBe(false);
  });

  it('пользователь без technicianId не считается назначенным', () => {
    expect(isAssignedTo({ ...technician, technicianId: null }, crew)).toBe(false);
  });
});

describe('assertCanEditRequest', () => {
  const crew = [{ technicianId: 'tech-record-1' }];

  it('администратор может редактировать любую заявку', () => {
    expect(() => assertCanEditRequest(admin, [])).not.toThrow();
    expect(() => assertCanEditRequest(admin, crew)).not.toThrow();
  });

  it('назначенный техник может редактировать свою заявку', () => {
    expect(() => assertCanEditRequest(technician, crew)).not.toThrow();
  });

  it('неназначенный техник получает 403 ForbiddenError', () => {
    expect(() => assertCanEditRequest(technician, [])).toThrow(ForbiddenError);
    expect(() => assertCanEditRequest(technician, [])).toThrow(
      'Техник может изменять только заявки, на которые он назначен',
    );
  });

  it('наблюдатель не редактирует заявки даже будучи в бригаде', () => {
    const viewerWithRecord: AuthUser = { ...viewer, technicianId: 'tech-record-1' };
    expect(() => assertCanEditRequest(viewerWithRecord, crew)).toThrow(ForbiddenError);
    expect(() => assertCanEditRequest(viewerWithRecord, crew)).toThrow(
      'Изменять заявки может только техник или администратор',
    );
  });
});