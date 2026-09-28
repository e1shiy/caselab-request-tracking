import { QueryTypes, type Sequelize, type Transaction } from 'sequelize';

import { logger } from '../../lib/logger.js';
import { createSequelize, waitForDatabase } from '../client.js';
import { initModels } from '../models/index.js';

const id = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const SITE_NORTH = id(1);
const SITE_SOUTH = id(2);

const TECHNICIAN_TURBINE = id(11);
const TECHNICIAN_SENSOR = id(12);
const TECHNICIAN_INVERTER = id(13);

const TURBINE_1 = id(21);
const SENSOR_7 = id(22);
const INVERTER_3 = id(23);
const SUBSTATION_9 = id(24);

const SITES = [
  {
    id: SITE_NORTH,
    name: 'Площадка Северная',
    code: 'SITE-NORTH',
    region: 'Московская область',
    latitude: 56.0101,
    longitude: 37.955,
  },
  {
    id: SITE_SOUTH,
    name: 'Площадка Южная',
    code: 'SITE-SOUTH',
    region: 'Калужская область',
    latitude: 54.5253,
    longitude: 36.2753,
  },
];

const TECHNICIANS = [
  { id: TECHNICIAN_TURBINE, full_name: 'Иванов Иван Иванович', specialization: 'Турбины', personnel_number: 'EMP-0001' },
  { id: TECHNICIAN_SENSOR, full_name: 'Петрова Анна Сергеевна', specialization: 'Датчики', personnel_number: 'EMP-0002' },
  { id: TECHNICIAN_INVERTER, full_name: 'Сидоров Пётр Олегович', specialization: 'Инверторы', personnel_number: 'EMP-0003' },
];

const EQUIPMENT = [
  {
    id: TURBINE_1,
    site_id: SITE_NORTH,
    name: 'Турбина Т-1',
    type: 'turbine',
    serial_number: 'DEMO-T-01',
    latitude: 56.012,
    longitude: 37.958,
    status: 'operational',
    installed_at: '2021-03-15',
  },
  {
    id: SENSOR_7,
    site_id: SITE_NORTH,
    name: 'Датчик Д-7',
    type: 'sensor',
    serial_number: 'DEMO-S-07',
    latitude: 56.014,
    longitude: 37.961,
    status: 'fault',
    installed_at: '2023-08-01',
  },
  {
    id: INVERTER_3,
    site_id: SITE_SOUTH,
    name: 'Инвертор И-3',
    type: 'inverter',
    serial_number: 'DEMO-I-03',
    latitude: 54.527,
    longitude: 36.278,
    status: 'maintenance',
    installed_at: '2022-05-20',
  },
  {
    id: SUBSTATION_9,
    site_id: null,
    name: 'Подстанция П-9',
    type: 'substation',
    serial_number: 'DEMO-SS-09',
    latitude: 55.7558,
    longitude: 37.6173,
    status: 'operational',
    installed_at: '2019-11-02',
  },
];

const PASSPORTS = [
  { equipment_id: TURBINE_1, manufacturer: 'Enercon', model: 'E-82 E2', rated_power_kw: 2000, last_verified_at: '2026-02-10' },
  { equipment_id: SENSOR_7, manufacturer: 'Вымпел', model: 'ВД-500', rated_power_kw: 0.05, last_verified_at: null },
  { equipment_id: INVERTER_3, manufacturer: 'SMA', model: 'SUN2000-100kTL', rated_power_kw: 100, last_verified_at: '2025-11-30' },
];

const REQUESTS = [
  {
    id: id(31),
    equipment_id: TURBINE_1,
    title: 'Плановое ТО турбины',
    description: 'Замена масла в редукторе, проверка затяжки болтов',
    priority: 'medium',
    status: 'in_progress',
    planned_at: '2026-03-10T09:00:00.000Z',
    author: 'seed',
    closed_at: null,
    created_at: '2026-02-01T08:00:00.000Z',
    updated_at: '2026-03-09T07:30:00.000Z',
  },
  {
    id: id(32),
    equipment_id: SENSOR_7,
    title: 'Датчик не отдаёт показания',
    description: 'Потеря связи с датчиком более суток',
    priority: 'critical',
    status: 'done',
    planned_at: '2026-02-20T12:00:00.000Z',
    author: 'seed',
    closed_at: '2026-02-20T15:00:00.000Z',
    created_at: '2026-02-18T06:00:00.000Z',
    updated_at: '2026-02-20T15:00:00.000Z',
  },
  {
    id: id(33),
    equipment_id: INVERTER_3,
    title: 'Ошибка инвертора',
    description: 'Код 0x0132, требуется диагностика',
    priority: 'high',
    status: 'rejected',
    planned_at: null,
    author: 'seed',
    closed_at: '2026-01-16T11:00:00.000Z',
    created_at: '2026-01-15T10:00:00.000Z',
    updated_at: '2026-01-16T11:00:00.000Z',
  },
  {
    id: id(34),
    equipment_id: TURBINE_1,
    title: 'Проверка вибрации',
    description: 'Плановый замер вибрации подшипников',
    priority: 'low',
    status: 'new',
    planned_at: null,
    author: 'seed',
    closed_at: null,
    created_at: '2026-03-01T05:00:00.000Z',
    updated_at: '2026-03-01T05:00:00.000Z',
  },
];

const HISTORY: Record<string, unknown>[] = [
  { id: id(41), request_id: id(31), previous_status: null, new_status: 'new', changed_by: 'seed', comment: 'Создана планировщиком', changed_at: '2026-02-01T08:00:00.000Z' },
  { id: id(42), request_id: id(31), previous_status: 'new', new_status: 'in_progress', changed_by: 'Иванов Иван Иванович', comment: 'Бригада приступила', changed_at: '2026-03-09T07:30:00.000Z' },
  { id: id(43), request_id: id(32), previous_status: null, new_status: 'new', changed_by: 'seed', comment: 'Создана планировщиком', changed_at: '2026-02-18T06:00:00.000Z' },
  { id: id(44), request_id: id(32), previous_status: 'new', new_status: 'in_progress', changed_by: 'Петрова Анна Сергеевна', comment: null, changed_at: '2026-02-19T09:00:00.000Z' },
  { id: id(45), request_id: id(32), previous_status: 'in_progress', new_status: 'done', changed_by: 'Петрова Анна Сергеевна', comment: 'Связь восстановлена', changed_at: '2026-02-20T15:00:00.000Z' },
  { id: id(46), request_id: id(33), previous_status: null, new_status: 'new', changed_by: 'seed', comment: 'Создана планировщиком', changed_at: '2026-01-15T10:00:00.000Z' },
  { id: id(47), request_id: id(33), previous_status: 'new', new_status: 'rejected', changed_by: 'Сидоров Пётр Олегович', comment: 'Ошибка была разовой', changed_at: '2026-01-16T11:00:00.000Z' },
  { id: id(48), request_id: id(34), previous_status: null, new_status: 'new', changed_by: 'seed', comment: 'Создана планировщиком', changed_at: '2026-03-01T05:00:00.000Z' },
];

const ASSIGNEES = [
  { request_id: id(31), technician_id: TECHNICIAN_TURBINE, role: 'lead', planned_hours: 8 },
  { request_id: id(31), technician_id: TECHNICIAN_SENSOR, role: 'member', planned_hours: 6 },
  { request_id: id(32), technician_id: TECHNICIAN_SENSOR, role: 'lead', planned_hours: 2 },
  { request_id: id(34), technician_id: TECHNICIAN_TURBINE, role: 'lead', planned_hours: 4 },
];

async function insertIgnore(
  sequelize: Sequelize,
  table: string,
  rows: readonly Record<string, unknown>[],
  conflict: string,
  transaction: Transaction,
  returning: string = 'id',
): Promise<number> {
  if (rows.length === 0) return 0;

  const queryInterface = sequelize.getQueryInterface();
  const columns = Object.keys(rows[0]!);
  const replacements: Record<string, unknown> = {};

  const tuples = rows.map((row, rowIndex) => {
    const placeholders = columns.map((column, columnIndex) => {
      const key = `r${rowIndex}_c${columnIndex}`;
      replacements[key] = row[column] ?? null;
      return `:${key}`;
    });
    return `(${placeholders.join(', ')})`;
  });

  const columnList = columns.map((column) => queryInterface.quoteIdentifier(column)).join(', ');
  const sql = `INSERT INTO ${queryInterface.quoteIdentifier(table)} (${columnList}) VALUES ${tuples.join(', ')} ON CONFLICT ${conflict} DO NOTHING RETURNING ${queryInterface.quoteIdentifier(returning)};`;

  const inserted = await sequelize.query<Record<string, unknown>>(sql, {
    replacements,
    type: QueryTypes.SELECT,
    transaction,
  });

  return inserted.length;
}

export async function seedDatabase(sequelize: Sequelize): Promise<void> {
  const summary = await sequelize.transaction(async (transaction) => ({
    sites: await insertIgnore(sequelize, 'sites', SITES, 'ON CONSTRAINT sites_code_key', transaction),
    technicians: await insertIgnore(sequelize, 'technicians', TECHNICIANS, 'ON CONSTRAINT technicians_personnel_number_key', transaction),
    equipment: await insertIgnore(sequelize, 'equipment', EQUIPMENT, 'ON CONSTRAINT equipment_serial_number_key', transaction),
    passports: await insertIgnore(sequelize, 'equipment_passports', PASSPORTS, 'ON CONSTRAINT equipment_passports_pkey', transaction, 'equipment_id'),
    requests: await insertIgnore(sequelize, 'maintenance_requests', REQUESTS, 'ON CONSTRAINT maintenance_requests_pkey', transaction),
    history: await insertIgnore(sequelize, 'request_status_history', HISTORY, 'ON CONSTRAINT request_status_history_pkey', transaction),
    assignees: await insertIgnore(sequelize, 'request_assignees', ASSIGNEES, 'ON CONSTRAINT request_assignees_pkey', transaction, 'request_id'),
  }));

  const added = Object.values(summary).reduce((sum, count) => sum + count, 0);
  logger.info({ ...summary, added }, added > 0 ? 'демо-данные загружены' : 'демо-данные уже были загружены');
}

async function main(): Promise<void> {
  const sequelize = createSequelize('app');
  try {
    await waitForDatabase(sequelize);
    initModels(sequelize);
    await seedDatabase(sequelize);
  } finally {
    await sequelize.close();
  }
}

try {
  await main();
} catch (err) {
  logger.error({ err }, 'не удалось загрузить демо-данные');
  process.exit(1);
}
