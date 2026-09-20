import type { MaintenanceRequest } from '../domain/request.js';

export interface RequestRepository {
  all(): Promise<MaintenanceRequest[]>;
  findById(id: string): Promise<MaintenanceRequest | null>;
  findByEquipmentId(equipmentId: string): Promise<MaintenanceRequest[]>;
  save(request: MaintenanceRequest): Promise<MaintenanceRequest>;
  remove(id: string): Promise<void>;
  removeByEquipmentId(equipmentId: string): Promise<number>;
}