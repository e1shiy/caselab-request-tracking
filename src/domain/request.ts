export const REQUEST_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type RequestPriority = (typeof REQUEST_PRIORITIES)[number];

export const REQUEST_STATUSES = ['new', 'in_progress', 'done', 'rejected'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export interface MaintenanceRequest {
  id: string;
  equipmentId: string;
  title: string;
  description: string;
  priority: RequestPriority;
  status: RequestStatus;
  plannedAt?: string;
  createdAt: string;
  updatedAt: string;
}