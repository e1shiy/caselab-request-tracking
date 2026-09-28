export interface EquipmentLoadRow {
  equipmentId: string;
  serialNumber: string;
  equipmentName: string;
  siteId: string | null;
  siteName: string | null;
  requestsTotal: number;
  requestsClosed: number;
  plannedHours: number;
  lastServicedAt: string | null;
}

export interface SiteSummary {
  siteId: string;
  siteName: string;
  siteCode: string;
  region: string;
  equipmentTotal: number;
  requestsTotal: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  averageCloseSeconds: number | null;
}
