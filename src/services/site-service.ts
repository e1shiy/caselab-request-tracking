import { REQUEST_PRIORITIES, REQUEST_STATUSES } from '../domain/request.js';
import type { SiteSummary } from '../domain/report.js';
import { NotFoundError } from '../errors.js';
import type { SiteRepository } from '../repositories/site-repository.js';

export class SiteService {
  constructor(private readonly siteRepo: SiteRepository) {}

  async summary(id: string): Promise<SiteSummary> {
    const totals = await this.siteRepo.summary(id);
    if (!totals) throw new NotFoundError('Площадка не найдена');

    const { site, equipmentTotal, requestsTotal, byStatus, byPriority, averageCloseSeconds } = totals;

    return {
      siteId: site.id,
      siteName: site.name,
      siteCode: site.code,
      region: site.region,
      equipmentTotal,
      requestsTotal,
      byStatus: withAllKeys(REQUEST_STATUSES, byStatus),
      byPriority: withAllKeys(REQUEST_PRIORITIES, byPriority),
      averageCloseSeconds,
    };
  }
}

function withAllKeys(keys: readonly string[], counts: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const key of keys) result[key] = counts[key] ?? 0;
  return result;
}
