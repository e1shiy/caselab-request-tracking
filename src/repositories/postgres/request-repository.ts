import { Op, type Transaction, type WhereOptions } from 'sequelize';

import { MaintenanceRequestModel } from '../../db/models/index.js';
import { RequestAssigneeModel } from '../../db/models/request-assignee.model.js';
import { RequestStatusHistoryModel } from '../../db/models/request-status-history.model.js';
import { TechnicianModel } from '../../db/models/technician.model.js';
import type { MaintenanceRequest } from '../../domain/request.js';
import type { RequestStatusHistoryEntry } from '../../domain/status-history.js';
import type { AssigneeView, Technician } from '../../domain/technician.js';
import type { RequestCreateInput, RequestUpdateInput } from '../../schemas/request.js';
import { pagination } from '../common.js';
import type { Page } from '../common.js';
import { withDbErrorTranslation } from '../db-errors.js';
import type {
  AssigneeInput,
  RequestCard,
  RequestListParams,
  RequestRepository,
  StatusChange,
} from '../request-repository.js';
import {
  maintenanceRequestColumns,
  requestAssigneeColumns,
  requestStatusHistoryColumns,
  technicianColumns,
} from './attributes.js';
import { toAssigneeView, toHistoryEntry, toRequest, toRequestCard, toTechnician } from './mappers.js';
import type { AssigneeRow } from './mappers.js';

const SORT_COLUMNS: Record<string, keyof MaintenanceRequest> = {
  priority: 'priority',
  status: 'status',
  plannedAt: 'plannedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

const OPEN_STATUSES = ['new', 'in_progress'] as const;

function buildWhere(params: RequestListParams): WhereOptions {
  const conditions: WhereOptions[] = [];

  if (params.status !== undefined) conditions.push({ status: params.status });
  if (params.priority !== undefined) conditions.push({ priority: params.priority });
  if (params.equipmentId !== undefined) conditions.push({ equipmentId: params.equipmentId });
  if (params.dateFrom !== undefined) conditions.push({ createdAt: { [Op.gte]: params.dateFrom } });
  if (params.dateTo !== undefined) conditions.push({ createdAt: { [Op.lte]: `${params.dateTo}T23:59:59.999Z` } });

  return conditions.length > 0 ? { [Op.and]: conditions } : {};
}

export class PostgresRequestRepository implements RequestRepository {
  async list(params: RequestListParams, transaction?: Transaction): Promise<Page<MaintenanceRequest>> {
    const where = buildWhere(params);
    const { offset, limit } = pagination(params.page, params.limit, params.offset);

    const order: [string, 'ASC' | 'DESC'][] = [];
    if (params.sort) {
      const column = SORT_COLUMNS[params.sort.field];
      if (column) order.push([column, params.sort.order === 'desc' ? 'DESC' : 'ASC']);
    }
    if (order.length === 0) order.push(['createdAt', 'ASC']);
    order.push(['id', 'ASC']);

    const [rows, total] = await Promise.all([
      MaintenanceRequestModel.findAll({
        attributes: [...maintenanceRequestColumns],
        where,
        order,
        offset,
        limit,
        transaction,
        raw: true,
      }),
      MaintenanceRequestModel.count({ where, transaction }),
    ]);

    return { rows: rows.map((row) => toRequest(row)), total };
  }

  async findById(id: string, transaction?: Transaction): Promise<MaintenanceRequest | null> {
    const row = await MaintenanceRequestModel.findByPk(id, {
      attributes: [...maintenanceRequestColumns],
      transaction,
      raw: true,
    });
    return row ? toRequest(row) : null;
  }

  async findCardById(id: string, transaction?: Transaction): Promise<RequestCard | null> {
    const row = await MaintenanceRequestModel.findByPk(id, {
      attributes: [...maintenanceRequestColumns],
      include: [
        {
          model: RequestAssigneeModel,
          as: 'assignees',
          attributes: [...requestAssigneeColumns],
          include: [
            { model: TechnicianModel, as: 'technician', attributes: [...technicianColumns] },
          ],
        },
      ],
      transaction,
    });
    if (!row) return null;
    return toRequestCard(row.get({ plain: true }) as Parameters<typeof toRequestCard>[0]);
  }

  async create(
    input: RequestCreateInput,
    author: string,
    transaction?: Transaction,
  ): Promise<MaintenanceRequest> {
    return withDbErrorTranslation({ missing: 'Оборудование не найдено' }, async () => {
      const row = await MaintenanceRequestModel.create(
        {
          equipmentId: input.equipmentId,
          title: input.title,
          description: input.description ?? '',
          priority: input.priority,
          plannedAt: input.plannedAt ? new Date(input.plannedAt) : null,
          author,
        },
        { transaction, raw: true },
      );

      const request = toRequest(row);

      await RequestStatusHistoryModel.create(
        {
          requestId: request.id,
          previousStatus: null,
          newStatus: request.status,
          changedBy: author,
          comment: 'Заявка создана',
        },
        { transaction },
      );

      return request;
    });
  }

  async update(
    id: string,
    input: RequestUpdateInput,
    transaction?: Transaction,
  ): Promise<MaintenanceRequest | null> {
    const changes: Record<string, unknown> = {};
    if (input.title !== undefined) changes.title = input.title;
    if (input.description !== undefined) changes.description = input.description;
    if (input.priority !== undefined) changes.priority = input.priority;
    if (input.plannedAt !== undefined) {
      changes.plannedAt = input.plannedAt ? new Date(input.plannedAt) : null;
    }

    return withDbErrorTranslation({ missing: 'Заявка не найдена' }, async () => {
      const [count] = await MaintenanceRequestModel.update(changes, { where: { id }, transaction });
      if (count === 0) return null;
      const row = await MaintenanceRequestModel.findByPk(id, { transaction, raw: true });
      return row ? toRequest(row) : null;
    });
  }

  async remove(id: string, transaction?: Transaction): Promise<boolean> {
    return withDbErrorTranslation({}, async () => {
      const count = await MaintenanceRequestModel.destroy({ where: { id }, transaction });
      return count > 0;
    });
  }

  async hasOpenRequests(equipmentId: string, transaction?: Transaction): Promise<boolean> {
    const count = await MaintenanceRequestModel.count({
      where: { equipmentId, status: { [Op.in]: [...OPEN_STATUSES] } },
      transaction,
    });
    return count > 0;
  }

  async changeStatus(
    id: string,
    change: StatusChange,
    transaction: Transaction,
  ): Promise<MaintenanceRequest | null> {
    return withDbErrorTranslation({ missing: 'Заявка не найдена' }, async () => {
      const closing = change.status === 'done' || change.status === 'rejected';
      const reopening = change.status === 'new' || change.status === 'in_progress';

      const [count] = await MaintenanceRequestModel.update(
        {
          status: change.status,
          ...(closing ? { closedAt: new Date() } : {}),
          ...(reopening ? { closedAt: null } : {}),
        },
        { where: { id, status: change.expectedStatus }, transaction },
      );

      if (count === 0) return null;

      await RequestStatusHistoryModel.create(
        {
          requestId: id,
          previousStatus: change.expectedStatus,
          newStatus: change.status,
          changedBy: change.changedBy,
          comment: change.comment ?? null,
        },
        { transaction },
      );

      const row = await MaintenanceRequestModel.findByPk(id, {
        attributes: [...maintenanceRequestColumns],
        transaction,
        raw: true,
      });
      return row ? toRequest(row) : null;
    });
  }

  async lockById(id: string, transaction: Transaction): Promise<MaintenanceRequest | null> {
    const row = await MaintenanceRequestModel.findByPk(id, {
      attributes: [...maintenanceRequestColumns],
      transaction,
      raw: true,
      lock: transaction.LOCK.UPDATE,
    });
    return row ? toRequest(row) : null;
  }

  async findTechniciansByIds(ids: string[], transaction: Transaction): Promise<Technician[]> {
    if (ids.length === 0) return [];
    const rows = await TechnicianModel.findAll({
      attributes: [...technicianColumns],
      where: { id: { [Op.in]: ids } },
      transaction,
      raw: true,
    });
    return rows.map((row) => toTechnician(row));
  }

  async countAssignees(requestId: string, transaction: Transaction): Promise<number> {
    return RequestAssigneeModel.count({ where: { requestId }, transaction });
  }

  async replaceAssignees(
    requestId: string,
    assignees: AssigneeInput[],
    transaction: Transaction,
  ): Promise<AssigneeView[]> {
    return withDbErrorTranslation(
      { missing: 'Специалист не найден', unique: 'В бригаде заявки может быть только один ведущий' },
      async () => {
        await RequestAssigneeModel.destroy({ where: { requestId }, transaction });
        await RequestAssigneeModel.bulkCreate(
          assignees.map((assignee) => ({
            requestId,
            technicianId: assignee.technicianId,
            role: assignee.role,
            plannedHours: assignee.plannedHours ?? null,
          })),
          { transaction },
        );
        return this.listAssignees(requestId, transaction);
      },
    );
  }

  async removeAssignee(requestId: string, technicianId: string, transaction: Transaction): Promise<boolean> {
    const count = await RequestAssigneeModel.destroy({ where: { requestId, technicianId }, transaction });
    return count > 0;
  }

  async listAssignees(requestId: string, transaction?: Transaction): Promise<AssigneeView[]> {
    const rows = await RequestAssigneeModel.findAll({
      attributes: [...requestAssigneeColumns],
      where: { requestId },
      include: [{ model: TechnicianModel, as: 'technician', attributes: [...technicianColumns] }],
      transaction,
      order: [['role', 'ASC'], ['assignedAt', 'ASC']],
    });
    return rows.map((row) => toAssigneeView(row.get({ plain: true }) as AssigneeRow));
  }

  async listHistory(
    requestId: string,
    transaction?: Transaction,
  ): Promise<RequestStatusHistoryEntry[]> {
    const rows = await RequestStatusHistoryModel.findAll({
      attributes: [...requestStatusHistoryColumns],
      where: { requestId },
      transaction,
      raw: true,
      order: [['changedAt', 'DESC']],
    });
    return rows.map((row) => toHistoryEntry(row));
  }
}
