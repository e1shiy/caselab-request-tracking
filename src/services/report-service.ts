import type { EquipmentLoadRow } from '../domain/report.js';
import type { ReportRepository } from '../repositories/report-repository.js';
import type { EquipmentLoadQuery } from '../schemas/report.js';

export interface EquipmentLoadResult {
  data: EquipmentLoadRow[];
  applied: {
    dateFrom?: string;
    dateTo?: string;
    siteId?: string;
    status?: string;
    priority?: string;
    limit: number;
  };
}

export class ReportService {
  constructor(private readonly reportRepo: ReportRepository) {}

  async equipmentLoad(query: EquipmentLoadQuery): Promise<EquipmentLoadResult> {
    const data = await this.reportRepo.equipmentLoad({
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      siteId: query.siteId,
      status: query.status,
      priority: query.priority,
      limit: query.limit,
    });

    return {
      data,
      applied: {
        ...(query.dateFrom !== undefined ? { dateFrom: query.dateFrom } : {}),
        ...(query.dateTo !== undefined ? { dateTo: query.dateTo } : {}),
        ...(query.siteId !== undefined ? { siteId: query.siteId } : {}),
        ...(query.status !== undefined ? { status: query.status } : {}),
        ...(query.priority !== undefined ? { priority: query.priority } : {}),
        limit: query.limit,
      },
    };
  }
}
