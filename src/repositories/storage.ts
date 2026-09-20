import path from 'node:path';

import { config } from '../config.js';
import type { Equipment } from '../domain/equipment.js';
import { JsonStore } from '../lib/json-store.js';
import type { EquipmentRepository } from './equipment-repository.js';
import type { RequestRepository } from './request-repository.js';
import type { MaintenanceRequest } from '../domain/request.js';

export class JsonEquipmentRepository implements EquipmentRepository {
  constructor(private readonly store: JsonStore<Equipment>) {}

  async all(): Promise<Equipment[]> {
    return this.store.all();
  }

  async findById(id: string): Promise<Equipment | null> {
    return (await this.store.find(id)) ?? null;
  }

  async save(equipment: Equipment): Promise<Equipment> {
    return this.store.save(equipment);
  }

  async remove(id: string): Promise<void> {
    await this.store.remove(id);
  }
}

export class JsonRequestRepository implements RequestRepository {
  constructor(private readonly store: JsonStore<MaintenanceRequest>) {}

  async all(): Promise<MaintenanceRequest[]> {
    return this.store.all();
  }

  async findById(id: string): Promise<MaintenanceRequest | null> {
    return (await this.store.find(id)) ?? null;
  }

  async findByEquipmentId(equipmentId: string): Promise<MaintenanceRequest[]> {
    const all = await this.store.all();
    return all.filter((request) => request.equipmentId === equipmentId);
  }

  async save(request: MaintenanceRequest): Promise<MaintenanceRequest> {
    return this.store.save(request);
  }

  async remove(id: string): Promise<void> {
    await this.store.remove(id);
  }

  async removeByEquipmentId(equipmentId: string): Promise<number> {
    return this.store.removeMany((request) => request.equipmentId === equipmentId);
  }
}

export interface Storage {
  equipment: EquipmentRepository;
  requests: RequestRepository;
}

export async function createStorage(): Promise<Storage> {
  const equipmentStore = new JsonStore<Equipment>(path.join(config.DATA_DIR, 'equipment.json'));
  const requestStore = new JsonStore<MaintenanceRequest>(path.join(config.DATA_DIR, 'requests.json'));

  await Promise.all([equipmentStore.load(), requestStore.load()]);

  return {
    equipment: new JsonEquipmentRepository(equipmentStore),
    requests: new JsonRequestRepository(requestStore),
  };
}