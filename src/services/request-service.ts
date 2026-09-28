import { config } from '../config.js';
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

    const { rows, total } = await this.requestRepo.list({
      status: query.status,
      priority: query.priority,
      equipmentId: equipmentId ?? query.equipmentId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      sort: query.sort,
      page: query.page,
      limit: query.limit,
    });

    return { data: rows, meta: { total, page: query.page, limit: query.limit } };
  }

  async getById(id: string): Promise<MaintenanceRequest> {
    const request = await this.requestRepo.findById(id);
    if (!request) throw new NotFoundError('Заявка не найдена');
    return request;
  }

  async create(input: RequestCreateInput): Promise<MaintenanceRequest> {
    const equipment = await this.equipmentRepo.findById(input.equipmentId);
    if (!equipment) throw new NotFoundError('Оборудование не найдено');

    return this.requestRepo.create(input, config.DEFAULT_AUTHOR);
  }

  async update(id: string, input: RequestUpdateInput): Promise<MaintenanceRequest> {
    const updated = await this.requestRepo.update(id, input);
    if (!updated) throw new NotFoundError('Заявка не найдена');
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

    const updated = await this.requestRepo.changeStatus(id, {
      expectedStatus: request.status,
      status,
      changedBy: config.DEFAULT_AUTHOR,
    });

    if (!updated) {
      throw new ConflictError('Статус заявки изменился параллельно, повторите запрос');
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    const request = await this.getById(id);
    await this.requestRepo.remove(request.id);
  }
}
