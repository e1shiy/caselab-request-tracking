export interface EquipmentPassport {
  equipmentId: string;
  manufacturer: string;
  model: string;
  ratedPowerKw: number;
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}
