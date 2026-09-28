import type { RequestPriority, RequestStatus } from '../domain/request.js';
import type { EquipmentLoadRow } from '../domain/report.js';

export interface EquipmentLoadParams {
  dateFrom?: string;
  dateTo?: string;
  siteId?: string;
  status?: RequestStatus;
  priority?: RequestPriority;
  limit: number;
}

export interface ReportRepository {
  equipmentLoad(params: EquipmentLoadParams): Promise<EquipmentLoadRow[]>;
}
