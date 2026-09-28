export const ASSIGNEE_ROLES = ['lead', 'member'] as const;
export type AssigneeRole = (typeof ASSIGNEE_ROLES)[number];

export interface Technician {
  id: string;
  fullName: string;
  specialization: string;
  personnelNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface RequestAssignee {
  requestId: string;
  technicianId: string;
  role: AssigneeRole;
  plannedHours: number | null;
  assignedAt: string;
}

export interface AssigneeView extends RequestAssignee {
  fullName: string;
  specialization: string;
  personnelNumber: string;
}
