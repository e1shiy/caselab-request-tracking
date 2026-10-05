import { config } from '../config.js';
import type { MaintenanceRequest, RequestStatus } from '../domain/request.js';
import type { RequestStatusHistoryEntry } from '../domain/status-history.js';
import type { AuthUser } from '../domain/user.js';
import { ConflictError, NotFoundError } from '../errors.js';
import type { EquipmentRepository, RequestRepository } from '../repositories/index.js';
import type { Transaction, TransactionRunner } from '../repositories/common.js';
import type { AssigneeInput, RequestCard } from '../repositories/request-repository.js';
import type {
  RequestAssigneesBody,
  RequestCreateInput,
  RequestListQuery,
  RequestStatusBody,
  RequestUpdateInput,
} from '../schemas/request.js';
import { assertCanEditRequest } from './access-control.js';

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

const CLOSED_STATUSES: readonly RequestStatus[] = ['done', 'rejected'];

export class RequestService {
  constructor(
    private readonly requestRepo: RequestRepository,
    private readonly equipmentRepo: EquipmentRepository,
    private readonly runInTransaction: TransactionRunner,
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
      offset: query.offset,
    });

    return { data: rows, meta: { total, page: query.page, limit: query.limit } };
  }

  async getById(id: string): Promise<RequestCard> {
    return this.requireCard(id);
  }

  async history(id: string): Promise<{ data: RequestStatusHistoryEntry[] }> {
    const request = await this.requestRepo.findById(id);
    if (!request) throw new NotFoundError('Заявка не найдена');

    return { data: await this.requestRepo.listHistory(id) };
  }

  async create(input: RequestCreateInput, actor: AuthUser): Promise<MaintenanceRequest> {
    const equipment = await this.equipmentRepo.findById(input.equipmentId);
    if (!equipment) throw new NotFoundError('Оборудование не найдено');

    return this.runInTransaction((transaction) => this.requestRepo.create(input, actor.fullName, transaction));
  }

  async update(id: string, input: RequestUpdateInput, actor: AuthUser): Promise<MaintenanceRequest> {
    await this.assertEditable(id, actor);

    const updated = await this.requestRepo.update(id, input);
    if (!updated) throw new NotFoundError('Заявка не найдена');
    return updated;
  }

  async changeStatus(id: string, body: RequestStatusBody, actor: AuthUser): Promise<RequestCard> {
    return this.runInTransaction(async (transaction) => {
      const request = await this.lockRequest(id, transaction);
      const card = await this.requireCard(id, transaction);

      assertCanEditRequest(actor, card.assignees);

      if (request.status === body.status) {
        throw new ConflictError(`Заявка уже находится в статусе «${body.status}»`);
      }

      const allowedNext = STATUS_TRANSITIONS[request.status];
      if (!allowedNext.includes(body.status)) {
        throw new ConflictError(
          `Переход из статуса «${request.status}» в «${body.status}» недопустим`,
        );
      }

      if (body.status === 'in_progress') {
        const assigned = await this.requestRepo.countAssignees(id, transaction);
        if (assigned === 0) {
          throw new ConflictError(
            'Перевод в статус «in_progress» требует назначенной бригады исполнителей',
          );
        }
      }

      const updated = await this.requestRepo.changeStatus(
        id,
        {
          expectedStatus: request.status,
          status: body.status,
          changedBy: actor.fullName,
          ...(body.comment !== undefined ? { comment: body.comment } : {}),
        },
        transaction,
      );

      if (!updated) {
        throw new ConflictError('Статус заявки изменился параллельно, повторите запрос');
      }

      return this.requireCard(id, transaction);
    });
  }

  async assignCrew(id: string, body: RequestAssigneesBody, actor: AuthUser): Promise<RequestCard> {
    return this.runInTransaction(async (transaction) => {
      const request = await this.lockRequest(id, transaction);
      const card = await this.requireCard(id, transaction);

      assertCanEditRequest(actor, card.assignees);

      if (CLOSED_STATUSES.includes(request.status)) {
        throw new ConflictError(`Бригаду нельзя изменить у заявки в статусе «${request.status}»`);
      }

      await this.assertTechniciansExist(body.assignees, transaction);
      await this.requestRepo.replaceAssignees(id, toAssigneeInputs(body.assignees), transaction);

      return this.requireCard(id, transaction);
    });
  }

  async removeAssignee(id: string, technicianId: string, actor: AuthUser): Promise<RequestCard> {
    return this.runInTransaction(async (transaction) => {
      const request = await this.lockRequest(id, transaction);
      const card = await this.requireCard(id, transaction);

      assertCanEditRequest(actor, card.assignees);

      if (CLOSED_STATUSES.includes(request.status)) {
        throw new ConflictError(`Бригаду нельзя изменить у заявки в статусе «${request.status}»`);
      }

      const crew = card.assignees;
      const target = crew.find((assignee) => assignee.technicianId === technicianId);
      if (!target) throw new NotFoundError('Специалист не назначен на заявку');

      if (target.role === 'lead' && crew.length > 1) {
        throw new ConflictError(
          'Нельзя снять ведущего, пока в бригаде назначены другие специалисты: сначала замените lead',
        );
      }

      await this.requestRepo.removeAssignee(id, technicianId, transaction);

      return this.requireCard(id, transaction);
    });
  }

  async delete(id: string): Promise<void> {
    const request = await this.getById(id);
    await this.requestRepo.remove(request.id);
  }

  private async assertEditable(id: string, actor: AuthUser): Promise<void> {
    assertCanEditRequest(actor, (await this.requireCard(id)).assignees);
  }

  private async lockRequest(id: string, transaction: Transaction): Promise<MaintenanceRequest> {
    const request = await this.requestRepo.lockById(id, transaction);
    if (!request) throw new NotFoundError('Заявка не найдена');
    return request;
  }

  private async requireCard(id: string, transaction?: Transaction): Promise<RequestCard> {
    const card = await this.requestRepo.findCardById(id, transaction);
    if (!card) throw new NotFoundError('Заявка не найдена');
    return card;
  }

  private async assertTechniciansExist(
    assignees: RequestAssigneesBody['assignees'],
    transaction: Transaction,
  ): Promise<void> {
    const requested = [...new Set(assignees.map((assignee) => assignee.technicianId))];
    const technicians = await this.requestRepo.findTechniciansByIds(requested, transaction);
    const known = new Set(technicians.map((technician) => technician.id));
    const missing = requested.filter((technicianId) => !known.has(technicianId));

    if (missing.length > 0) {
      throw new NotFoundError('Специалист не найден', { details: { technicianIds: missing } });
    }
  }
}

function toAssigneeInputs(assignees: RequestAssigneesBody['assignees']): AssigneeInput[] {
  return assignees.map((assignee) => ({
    technicianId: assignee.technicianId,
    role: assignee.role,
    ...(assignee.plannedHours !== undefined ? { plannedHours: assignee.plannedHours } : {}),
  }));
}
