import { QueryTypes, type Sequelize } from 'sequelize';

import type { EquipmentLoadRow } from '../../domain/report.js';
import type { EquipmentLoadParams, ReportRepository } from '../report-repository.js';

type LoadRow = {
  equipmentId: string;
  serialNumber: string;
  equipmentName: string;
  siteId: string | null;
  siteName: string | null;
  requestsTotal: string;
  requestsClosed: string;
  plannedHours: number | null;
  lastServicedAt: Date | null;
};

export class PostgresReportRepository implements ReportRepository {
  constructor(private readonly sequelize: Sequelize) {}

  async equipmentLoad(params: EquipmentLoadParams): Promise<EquipmentLoadRow[]> {
    const conditions: string[] = [];
    const replacements: Record<string, unknown> = { limit: params.limit };

    if (params.dateFrom !== undefined) {
      conditions.push('mr.created_at >= :dateFrom');
      replacements['dateFrom'] = `${params.dateFrom}T00:00:00.000Z`;
    }
    if (params.dateTo !== undefined) {
      conditions.push('mr.created_at <= :dateTo');
      replacements['dateTo'] = `${params.dateTo}T23:59:59.999Z`;
    }
    if (params.siteId !== undefined) {
      conditions.push('e.site_id = :siteId');
      replacements['siteId'] = params.siteId;
    }
    if (params.status !== undefined) {
      conditions.push('mr.status = :status');
      replacements['status'] = params.status;
    }
    if (params.priority !== undefined) {
      conditions.push('mr.priority = :priority');
      replacements['priority'] = params.priority;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join('\n          AND ')}` : '';

    const rows = await this.sequelize.query<LoadRow>(
      `SELECT e.id AS "equipmentId",
              e.serial_number AS "serialNumber",
              e.name AS "equipmentName",
              e.site_id AS "siteId",
              s.name AS "siteName",
              count(*)::int AS "requestsTotal",
              count(*) FILTER (WHERE mr.closed_at IS NOT NULL)::int AS "requestsClosed",
              COALESCE(sum(crew.planned_hours), 0)::double precision AS "plannedHours",
              max(mr.closed_at) AS "lastServicedAt"
         FROM maintenance_requests mr
         JOIN equipment e ON e.id = mr.equipment_id
         LEFT JOIN sites s ON s.id = e.site_id
         LEFT JOIN LATERAL (
              SELECT sum(ra.planned_hours) AS planned_hours
                FROM request_assignees ra
               WHERE ra.request_id = mr.id
         ) crew ON true
         ${where}
        GROUP BY e.id, e.serial_number, e.name, e.site_id, s.name
        ORDER BY "requestsTotal" DESC, "plannedHours" DESC, e.id ASC
        LIMIT :limit`,
      { replacements, type: QueryTypes.SELECT },
    );

    return rows.map((row) => ({
      equipmentId: row.equipmentId,
      serialNumber: row.serialNumber,
      equipmentName: row.equipmentName,
      siteId: row.siteId,
      siteName: row.siteName,
      requestsTotal: Number(row.requestsTotal),
      requestsClosed: Number(row.requestsClosed),
      plannedHours: Number(row.plannedHours),
      lastServicedAt: row.lastServicedAt === null ? null : new Date(row.lastServicedAt).toISOString(),
    }));
  }
}
