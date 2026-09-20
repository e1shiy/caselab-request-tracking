import type { Equipment } from '../domain/equipment.js';

export interface EquipmentRepository {
  all(): Promise<Equipment[]>;
  findById(id: string): Promise<Equipment | null>;
  save(equipment: Equipment): Promise<Equipment>;
  remove(id: string): Promise<void>;
}