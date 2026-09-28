import { QueryTypes, type Sequelize } from 'sequelize';

import { SiteModel } from '../../db/models/index.js';
import type { Site } from '../../domain/site.js';
import { siteColumns } from './attributes.js';
import { toSite } from './mappers.js';
import type { SiteRepository, SiteSummaryTotals } from '../site-repository.js';

type BucketRow = { bucket: 'status' | 'priority'; key: string; total: string };

type AverageRow = { average: number | null };

export class PostgresSiteRepository implements SiteRepository {
  constructor(private readonly sequelize: Sequelize) {}

  async findById(id: string): Promise<Site | null> {
    const row = await SiteModel.findByPk(id, { attributes: [...siteColumns], raw: true });
    return row ? toSite(row) : null;
  }

  async summary(id: string): Promise<SiteSummaryTotals | null> {
    const site = await this.findById(id);
    if (!site) return null;

    const [equipmentTotal, buckets, average] = await Promise.all([
      this.equipmentTotal(id),
      this.requestBuckets(id),
      this.averageCloseSeconds(id),
    ]);

    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let requestsTotal = 0;

    for (const bucket of buckets) {
      const counts = bucket.bucket === 'status' ? byStatus : byPriority;
      counts[bucket.key] = Number(bucket.total);
      if (bucket.bucket === 'status') requestsTotal += Number(bucket.total);
    }

    return { site, equipmentTotal, requestsTotal, byStatus, byPriority, averageCloseSeconds: average };
  }

  private async equipmentTotal(siteId: string): Promise<number> {
    const rows = await this.sequelize.query<{ total: string }>(
      `SELECT count(*)::text AS total
         FROM equipment
        WHERE site_id = :siteId`,
      { replacements: { siteId }, type: QueryTypes.SELECT },
    );
    return Number(rows[0]?.total ?? 0);
  }

  private async requestBuckets(siteId: string): Promise<BucketRow[]> {
    return this.sequelize.query<BucketRow>(
      `SELECT 'status'::text AS bucket, mr.status::text AS key, count(*)::text AS total
         FROM maintenance_requests mr
         JOIN equipment e ON e.id = mr.equipment_id
        WHERE e.site_id = :siteId
        GROUP BY mr.status
       UNION ALL
       SELECT 'priority'::text AS bucket, mr.priority::text AS key, count(*)::text AS total
         FROM maintenance_requests mr
         JOIN equipment e ON e.id = mr.equipment_id
        WHERE e.site_id = :siteId
        GROUP BY mr.priority`,
      { replacements: { siteId }, type: QueryTypes.SELECT },
    );
  }

  private async averageCloseSeconds(siteId: string): Promise<number | null> {
    const rows = await this.sequelize.query<AverageRow>(
      `SELECT avg(EXTRACT(EPOCH FROM (mr.closed_at - mr.created_at))) AS average
         FROM maintenance_requests mr
         JOIN equipment e ON e.id = mr.equipment_id
        WHERE e.site_id = :siteId
          AND mr.closed_at IS NOT NULL`,
      { replacements: { siteId }, type: QueryTypes.SELECT },
    );
    const average = rows[0]?.average;
    return average === null || average === undefined ? null : Math.round(Number(average));
  }
}
