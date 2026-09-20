export const EQUIPMENT_TYPES = ['turbine', 'inverter', 'sensor', 'substation'] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

export const EQUIPMENT_STATUSES = ['operational', 'maintenance', 'fault', 'decommissioned'] as const;
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];

export interface EquipmentLocation {
  lat: number;
  lon: number;
}

export interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  serialNumber: string;
  location: EquipmentLocation;
  status: EquipmentStatus;
  installedAt: string;
  createdAt: string;
  updatedAt: string;
}