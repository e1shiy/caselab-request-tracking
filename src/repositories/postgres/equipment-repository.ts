import { Op, type Sequelize, type Transaction, type WhereOptions } from 'sequelize';

import { EquipmentModel } from '../../db/models/index.js';
import { EquipmentPassportModel } from '../../db/models/equipment-passport.model.js';
import type { Equipment, EquipmentCard } from '../../domain/equipment.js';
import type { EquipmentCreateInput, EquipmentUpdateInput } from '../../schemas/equipment.js';
import { pagination } from '../common.js';
import type { Page } from '../common.js';
import { withDbErrorTranslation } from '../db-errors.js';
import type { EquipmentListParams, EquipmentRepository } from '../equipment-repository.js';
import { toEquipment, toEquipmentCard } from './mappers.js';
import type { PassportRow } from './mappers.js';

const SORT_COLUMNS: Record<string, keyof Equipment> = {
  name: 'name',
  type: 'type',
  status: 'status',
  serialNumber: 'serialNumber',
  installedAt: 'installedAt',
  createdAt: 'createdAt',
};

function buildWhere(params: EquipmentListParams): WhereOptions {
  const conditions: WhereOptions[] = [];

  if (params.status !== undefined) conditions.push({ status: params.status });
  if (params.type !== undefined) conditions.push({ type: params.type });
  if (params.siteId !== undefined) conditions.push({ siteId: params.siteId });
  if (params.installedFrom !== undefined) conditions.push({ installedAt: { [Op.gte]: params.installedFrom } });
  if (params.installedTo !== undefined) conditions.push({ installedAt: { [Op.lte]: params.installedTo } });

  return conditions.length > 0 ? { [Op.and]: conditions } : {};
}

export class PostgresEquipmentRepository implements EquipmentRepository {
  constructor(private readonly sequelize: Sequelize) {}

  async list(params: EquipmentListParams, transaction?: Transaction): Promise<Page<Equipment>> {
    const where = buildWhere(params);
    const { offset, limit } = pagination(params.page, params.limit);

    const order: [string, 'ASC' | 'DESC'][] = [];
    if (params.sort) {
      const column = SORT_COLUMNS[params.sort.field];
      if (column) order.push([column, params.sort.order === 'desc' ? 'DESC' : 'ASC']);
    }
    if (order.length === 0) order.push(['createdAt', 'ASC']);
    order.push(['id', 'ASC']);

    const [rows, total] = await Promise.all([
      EquipmentModel.findAll({
        where,
        order,
        offset,
        limit,
        transaction,
        raw: true,
      }),
      EquipmentModel.count({ where, transaction }),
    ]);

    return { rows: rows.map((row) => toEquipment(row)), total };
  }

  async findById(id: string, transaction?: Transaction): Promise<Equipment | null> {
    const row = await EquipmentModel.findByPk(id, { transaction, raw: true });
    return row ? toEquipment(row) : null;
  }

  async findCardById(id: string, transaction?: Transaction): Promise<EquipmentCard | null> {
    const row = await EquipmentModel.findByPk(id, {
      include: [{ model: EquipmentPassportModel, as: 'passport' }],
      transaction,
    });
    if (!row) return null;

    const { passport, ...attributes } = row.get({ plain: true }) as Parameters<typeof toEquipmentCard>[0] & {
      passport?: PassportRow | null;
    };

    return toEquipmentCard(attributes, passport ?? null);
  }

  async create(
    input: EquipmentCreateInput,
    siteId: string | null,
    transaction?: Transaction,
  ): Promise<Equipment> {
    return withDbErrorTranslation(
      { unique: `Оборудование с серийным номером «${input.serialNumber}» уже существует` },
      async () => {
        const row = await EquipmentModel.create(
          {
            siteId,
            name: input.name,
            type: input.type,
            serialNumber: input.serialNumber,
            latitude: input.location.lat,
            longitude: input.location.lon,
            status: input.status,
            installedAt: input.installedAt,
          },
          { transaction, raw: true },
        );
        return toEquipment(row);
      },
    );
  }

  async update(
    id: string,
    input: EquipmentUpdateInput,
    siteId: string | null | undefined,
    transaction?: Transaction,
  ): Promise<Equipment | null> {
    const changes: Record<string, unknown> = {};
    if (input.name !== undefined) changes.name = input.name;
    if (input.type !== undefined) changes.type = input.type;
    if (input.serialNumber !== undefined) changes.serialNumber = input.serialNumber;
    if (input.status !== undefined) changes.status = input.status;
    if (input.installedAt !== undefined) changes.installedAt = input.installedAt;
    if (input.location !== undefined) {
      changes.latitude = input.location.lat;
      changes.longitude = input.location.lon;
    }
    if (siteId !== undefined) changes.siteId = siteId;

    return withDbErrorTranslation(
      { unique: `Оборудование с серийным номером «${input.serialNumber}» уже существует` },
      async () => {
        const [count] = await EquipmentModel.update(changes, { where: { id }, transaction });
        if (count === 0) return null;
        const row = await EquipmentModel.findByPk(id, { transaction, raw: true });
        return row ? toEquipment(row) : null;
      },
    );
  }

  async remove(id: string, transaction?: Transaction): Promise<boolean> {
    return withDbErrorTranslation({}, async () => {
      const count = await EquipmentModel.destroy({ where: { id }, transaction });
      return count > 0;
    });
  }

  async existsBySerialNumber(
    serialNumber: string,
    excludeId?: string,
    transaction?: Transaction,
  ): Promise<boolean> {
    const count = await EquipmentModel.count({
      where: excludeId ? { serialNumber, id: { [Op.ne]: excludeId } } : { serialNumber },
      transaction,
    });
    return count > 0;
  }
}
