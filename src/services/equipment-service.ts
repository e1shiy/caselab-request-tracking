import type { Equipment, EquipmentCard, EquipmentStatus, EquipmentType } from '../domain/equipment.js';
import { ConflictError, NotFoundError } from '../errors.js';
import type { EquipmentRepository, RequestRepository } from '../repositories/index.js';
import type { EquipmentCreateInput, EquipmentListQuery, EquipmentUpdateInput } from '../schemas/equipment.js';

export interface EquipmentListResult {
  data: Equipment[];
  meta: { total: number; page: number; limit: number };
}

export class EquipmentService {
  constructor(
    private readonly equipmentRepo: EquipmentRepository,
    private readonly requestRepo: RequestRepository,
  ) {}

  async list(query: EquipmentListQuery): Promise<EquipmentListResult> {
    const { rows, total } = await this.equipmentRepo.list({
      status: query.status as EquipmentStatus | undefined,
      type: query.type as EquipmentType | undefined,
      installedFrom: query.installedFrom,
      installedTo: query.installedTo,
      sort: query.sort,
      page: query.page,
      limit: query.limit,
    });

    return { data: rows, meta: { total, page: query.page, limit: query.limit } };
  }

  async getById(id: string): Promise<Equipment> {
    const equipment = await this.equipmentRepo.findById(id);
    if (!equipment) throw new NotFoundError('Оборудование не найдено');
    return equipment;
  }

  async getCardById(id: string): Promise<EquipmentCard> {
    const equipment = await this.equipmentRepo.findCardById(id);
    if (!equipment) throw new NotFoundError('Оборудование не найдено');
    return equipment;
  }

  async create(input: EquipmentCreateInput): Promise<Equipment> {
    await this.assertSerialNumberUnique(input.serialNumber);
    return this.equipmentRepo.create(input, null);
  }

  async update(id: string, input: EquipmentUpdateInput): Promise<Equipment> {
    await this.getById(id);

    if (input.serialNumber !== undefined) {
      await this.assertSerialNumberUnique(input.serialNumber, id);
    }

    const updated = await this.equipmentRepo.update(id, input, undefined);
    if (!updated) throw new NotFoundError('Оборудование не найдено');
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);

    if (await this.requestRepo.hasOpenRequests(id)) {
      throw new ConflictError('Нельзя удалить оборудование с открытыми заявками: завершите или отклоните их');
    }

    await this.equipmentRepo.remove(id);
  }

  private async assertSerialNumberUnique(serialNumber: string, excludeId?: string): Promise<void> {
    if (await this.equipmentRepo.existsBySerialNumber(serialNumber, excludeId)) {
      throw new ConflictError(`Оборудование с серийным номером «${serialNumber}» уже существует`);
    }
  }
}
