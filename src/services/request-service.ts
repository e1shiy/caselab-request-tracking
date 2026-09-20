import { randomUUID } from 'node:crypto';

import type { MaintenanceRequest, RequestStatus } from '../domain/request.js';
import { ConflictError, NotFoundError } from '../errors.js';
import type { EquipmentRepository, RequestRepository } from '../repositories/index.js';
import type { RequestCreateInput, RequestListQuery, RequestUpdateInput } from '../schemas/request.js';

export interface RequestListResult {
  data: MaintenanceRequest[];
  meta: { total: number; page: number; limit: number };
}

const STATUS_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  new: ['in_progress', 'rejected'],
  in_progress: ['done', 'rejected'],
  done: [],
  rejected: [],
};

export class RequestService {
  constructor(
    private readonly requestRepo: RequestRepository,
    private readonly equipmentRepo: EquipmentRepository,
  ) {}

  async list(equipmentId: string | undefined, query: RequestListQuery): Promise<RequestListResult> {
    if (equipmentId !== undefined) {
      const equipment = await this.equipmentRepo.findById(equipmentId);
      if (!equipment) throw new NotFoundError('Оборудование не найдено');
    }

    let items =
      equipmentId !== undefined
        ? await this.requestRepo.findByEquipmentId(equipmentId)
        : await this.requestRepo.all();

    if (query.status !== undefined) items = items.filter((item) => item.status === query.status);
    if (query.priority !== undefined) items = items.filter((item) => item.priority === query.priority);
    if (query.equipmentId !== undefined) items = items.filter((item) => item.equipmentId === query.equipmentId);
    if (query.dateFrom !== undefined) {
      items = items.filter((item) => item.createdAt.slice(0, 10) >= query.dateFrom!);
    }
    if (query.dateTo !== undefined) {
      items = items.filter((item) => item.createdAt.slice(0, 10) <= query.dateTo!);
    }

    if (query.sort !== undefined) {
      const { field, order } = query.sort;
      items.sort((a, b) => {
        const left = a[field as keyof MaintenanceRequest] ?? '';
        const right = b[field as keyof MaintenanceRequest] ?? '';
        const result = String(left).localeCompare(String(right));
        return order === 'asc' ? result : -result;
      });
    }

    const total = items.length;
    const offset = (query.page - 1) * query.limit;
    const data = items.slice(offset, offset + query.limit);

    return { data, meta: { total, page: query.page, limit: query.limit } };
  }

  async getById(id: string): Promise<MaintenanceRequest> {
    const request = await this.requestRepo.findById(id);
    if (!request) throw new NotFoundError('Заявка не найдена');
    return request;
  }

  async create(input: RequestCreateInput): Promise<MaintenanceRequest> {
    const equipment = await this.equipmentRepo.findById(input.equipmentId);
    if (!equipment) throw new NotFoundError('Оборудование не найдено');

    const now = new Date().toISOString();
    const request: MaintenanceRequest = {
      id: randomUUID(),
      equipmentId: input.equipmentId,
      title: input.title,
      description: input.description ?? '',
      priority: input.priority,
      status: 'new',
      plannedAt: input.plannedAt,
      createdAt: now,
      updatedAt: now,
    };

    await this.requestRepo.save(request);
    return request;
  }

  async update(id: string, input: RequestUpdateInput): Promise<MaintenanceRequest> {
    const request = await this.getById(id);

    const updated: MaintenanceRequest = {
      ...request,
      ...input,
      id: request.id,
      equipmentId: request.equipmentId,
      status: request.status,
      plannedAt: input.plannedAt === undefined ? request.plannedAt : (input.plannedAt ?? undefined),
      createdAt: request.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await this.requestRepo.save(updated);
    return updated;
  }

  async changeStatus(id: string, status: RequestStatus): Promise<MaintenanceRequest> {
    const request = await this.getById(id);

    if (request.status === status) {
      throw new ConflictError(`Заявка уже находится в статусе «${status}»`);
    }

    const allowedNext = STATUS_TRANSITIONS[request.status];
    if (!allowedNext.includes(status)) {
      throw new ConflictError(`Переход из статуса «${request.status}» в «${status}» недопустим`);
    }

    const updated: MaintenanceRequest = {
      ...request,
      status,
      updatedAt: new Date().toISOString(),
    };

    await this.requestRepo.save(updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);
    await this.requestRepo.remove(id);
  }
}