import type { RequestStatus } from './request.js';

export interface RequestStatusHistoryEntry {
  id: string;
  requestId: string;
  previousStatus: RequestStatus | null;
  newStatus: RequestStatus;
  changedBy: string | null;
  comment: string | null;
  changedAt: string;
}
