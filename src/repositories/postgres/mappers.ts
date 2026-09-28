import type { Equipment, EquipmentCard } from '../../domain/equipment.js';
import type { MaintenanceRequest } from '../../domain/request.js';
import type { RequestStatusHistoryEntry } from '../../domain/status-history.js';
import type { AssigneeView } from '../../domain/technician.js';

type EquipmentRow = {
  id: string;
  siteId: string | null;
  name: string;
  type: Equipment['type'];
  serialNumber: string;
  latitude: number;
  longitude: number;
  status: Equipment['status'];
  installedAt: string;
  createdAt: Date;
  updatedAt: Date;
};

function iso(value: Date): string {
  return value.toISOString();
}

export function toEquipment(row: EquipmentRow): Equipment {
  return {
    id: row.id,
    ...(row.siteId ? { siteId: row.siteId } : {}),
    name: row.name,
    type: row.type,
    serialNumber: row.serialNumber,
    location: { lat: row.latitude, lon: row.longitude },
    status: row.status,
    installedAt: row.installedAt,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export type PassportRow = {
  equipmentId: string;
  manufacturer: string;
  model: string;
  ratedPowerKw: number;
  lastVerifiedAt: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toEquipmentCard(row: EquipmentRow, passport: PassportRow | null): EquipmentCard {
  return {
    ...toEquipment(row),
    passport: passport
      ? {
          equipmentId: passport.equipmentId,
          manufacturer: passport.manufacturer,
          model: passport.model,
          ratedPowerKw: passport.ratedPowerKw,
          ...(passport.lastVerifiedAt ? { lastVerifiedAt: passport.lastVerifiedAt } : {}),
          createdAt: iso(passport.createdAt),
          updatedAt: iso(passport.updatedAt),
        }
      : null,
  };
}

type RequestRow = {
  id: string;
  equipmentId: string;
  title: string;
  description: string;
  priority: MaintenanceRequest['priority'];
  status: MaintenanceRequest['status'];
  plannedAt: Date | null;
  author: string;
  createdAt: Date;
  updatedAt: Date;
};

export function toRequest(row: RequestRow): MaintenanceRequest {
  return {
    id: row.id,
    equipmentId: row.equipmentId,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    ...(row.plannedAt ? { plannedAt: iso(row.plannedAt) } : {}),
    author: row.author,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function toHistoryEntry(row: {
  id: string;
  requestId: string;
  previousStatus: RequestStatusHistoryEntry['previousStatus'];
  newStatus: RequestStatusHistoryEntry['newStatus'];
  changedBy: string | null;
  comment: string | null;
  changedAt: Date;
}): RequestStatusHistoryEntry {
  return {
    id: row.id,
    requestId: row.requestId,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    changedBy: row.changedBy,
    comment: row.comment,
    changedAt: iso(row.changedAt),
  };
}

export function toAssigneeView(row: {
  requestId: string;
  technicianId: string;
  role: AssigneeView['role'];
  plannedHours: number | null;
  assignedAt: Date;
  fullName: string;
  specialization: string;
  personnelNumber: string;
}): AssigneeView {
  return {
    requestId: row.requestId,
    technicianId: row.technicianId,
    role: row.role,
    plannedHours: row.plannedHours,
    assignedAt: iso(row.assignedAt),
    fullName: row.fullName,
    specialization: row.specialization,
    personnelNumber: row.personnelNumber,
  };
}
