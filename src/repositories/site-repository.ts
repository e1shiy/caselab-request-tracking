import type { Site } from '../domain/site.js';
import type { SiteSummary } from '../domain/report.js';
import type { Transaction } from './common.js';

export interface SiteSummaryTotals {
  site: Site;
  equipmentTotal: number;
  requestsTotal: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  averageCloseSeconds: number | null;
}

export interface SiteRepository {
  findById(id: string, transaction?: Transaction): Promise<Site | null>;
  summary(id: string): Promise<SiteSummaryTotals | null>;
}
