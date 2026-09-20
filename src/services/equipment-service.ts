import { randomUUID } from 'node:crypto';

import type { Equipment } from '../domain/equipment.js';
import { ConflictError, NotFoundError } from '../errors.js';
import type { EquipmentRepository, RequestRepository } from '../repositories/index.js';
import type { EquipmentCreateInput, EquipmentListQuery, EquipmentUpdateInput } from '../schemas/equipment.js';

export interface EquipmentListResult {
  data: Equipment[];
  meta: { total: number; page: number; limit: number };
}

const OPEN_REQUEST_STATUSES = ['new', 'in_progress'];

export class EquipmentService {
  constructor(
    private readonly equipmentRepo: EquipmentRepository,
    private readonly requestRepo: RequestRepository,
  ) {}

  async list(query: EquipmentListQuery): Promise<EquipmentListResult> {
    let items = await this.equipmentRepo.all();

    if (query.status !== undefined) items = items.filter((item) => item.status === query.status);
    if (query.type !== undefined) items = items.filter((item) => item.type === query.type);

    if (query.sort !== undefined) {
      const { field, order } = query.sort;
      items.sort((a, b) => {
        const left = String(a[field as keyof Equipment] ?? '');
        const right = String(b[field as keyof Equipment] ?? '');
        const result = left.localeCompare(right);
        return order === 'asc' ? result : -result;
      });
    }

    const total = items.length;
    const offset = (query.page - 1) * query.limit;
    const data = items.slice(offset, offset + query.limit);

    return { data, meta: { total, page: query.page, limit: query.limit } };
  }

  async getById(id: string): Promise<Equipment> {
    const equipment = await this.equipmentRepo.findById(id);
    if (!equipment) throw new NotFoundError('Оборудование не найдено');
    return equipment;
  }

  async create(input: EquipmentCreateInput): Promise<Equipment> {
    await this.assertSerialNumberUnique(input.serialNumber);

    const now = new Date().toISOString();
    const equipment: Equipment = {
      id: randomUUID(),
      ...input,
      createdAt: now,
      updatedAt: now,
    };

    await this.equipmentRepo.save(equipment);
    return equipment;
  }

  async update(id: string, input: EquipmentUpdateInput): Promise<Equipment> {
    const equipment = await this.getById(id);

    if (input.serialNumber !== undefined && input.serialNumber !== equipment.serialNumber) {
      await this.assertSerialNumberUnique(input.serialNumber, id);
    }

    const updated: Equipment = {
      ...equipment,
      ...input,
      id: equipment.id,
      createdAt: equipment.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await this.equipmentRepo.save(updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);

    const requests = await this.requestRepo.findByEquipmentId(id);
    const hasOpen = requests.some((request) => OPEN_REQUEST_STATUSES.includes(request.status));

    if (hasOpen) {
      throw new ConflictError('Нельзя удалить оборудование с открытыми заявками: завершите или отклоните их');
    }

    await this.equipmentRepo.remove(id);
    await this.requestRepo.removeByEquipmentId(id);
  }

  private async assertSerialNumberUnique(serialNumber: string, excludeId?: string): Promise<void> {
    const all = await this.equipmentRepo.all();
    const duplicate = all.some((item) => item.serialNumber === serialNumber && item.id !== excludeId);
    if (duplicate) {
      throw new ConflictError(`Оборудование с серийным номером «${serialNumber}» уже существует`);
    }
  }
}