import type { MaintenanceRequest, RequestPriority, RequestStatus } from '../domain/request.js';
import type { RequestStatusHistoryEntry } from '../domain/status-history.js';
import type { AssigneeView } from '../domain/technician.js';
import type { RequestCreateInput, RequestUpdateInput } from '../schemas/request.js';
import type { ListParams, Page, Transaction } from './common.js';

export interface RequestListParams extends ListParams {
  status?: RequestStatus;
  priority?: RequestPriority;
  equipmentId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface RequestCard extends MaintenanceRequest {
  assignees: AssigneeView[];
}

export interface AssigneeInput {
  technicianId: string;
  role: 'lead' | 'member';
  plannedHours?: number;
}

export interface StatusChange {
  expectedStatus: RequestStatus;
  status: RequestStatus;
  changedBy: string;
  comment?: string;
}

export interface RequestRepository {
  list(params: RequestListParams, transaction?: Transaction): Promise<Page<MaintenanceRequest>>;
  findById(id: string, transaction?: Transaction): Promise<MaintenanceRequest | null>;
  findCardById(id: string, transaction?: Transaction): Promise<RequestCard | null>;
  create(input: RequestCreateInput, author: string, transaction?: Transaction): Promise<MaintenanceRequest>;

  update(id: string, input: RequestUpdateInput, transaction?: Transaction): Promise<MaintenanceRequest | null>;

  remove(id: string, transaction?: Transaction): Promise<boolean>;
  hasOpenRequests(equipmentId: string, transaction?: Transaction): Promise<boolean>;

  changeStatus(
    id: string,
    change: StatusChange,
    transaction?: Transaction,
  ): Promise<MaintenanceRequest | null>;

  listAssignees(requestId: string, transaction?: Transaction): Promise<AssigneeView[]>;
  listHistory(requestId: string, transaction?: Transaction): Promise<RequestStatusHistoryEntry[]>;
}
