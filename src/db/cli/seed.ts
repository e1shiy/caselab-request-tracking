import { QueryTypes, type Sequelize, type Transaction } from 'sequelize';

import { config } from '../../config.js';
import { logger } from '../../lib/logger.js';
import { hashPassword } from '../../lib/password.js';
import { createSequelize, waitForDatabase } from '../client.js';
import { initModels } from '../models/index.js';

const id = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const SITE_NORTH = id(1);
const SITE_SOUTH = id(2);

const TECHNICIAN_TURBINE = id(11);
const TECHNICIAN_SENSOR = id(12);
const TECHNICIAN_INVERTER = id(13);
const TECHNICIAN_CABLE = id(14);
const TECHNICIAN_SUBSTATION = id(15);

const TURBINE_1 = id(21);
const SENSOR_7 = id(22);
const INVERTER_3 = id(23);
const SUBSTATION_9 = id(24);
const CABLE_LINE_5 = id(25);
const SUBSTATION_12 = id(26);

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
  { id: TECHNICIAN_CABLE, full_name: 'Кузнецова Мария Викторовна', specialization: 'Кабельные сети', personnel_number: 'EMP-0004' },
  { id: TECHNICIAN_SUBSTATION, full_name: 'Волков Дмитрий Сергеевич', specialization: 'Подстанции', personnel_number: 'EMP-0005' },
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
  {
    id: CABLE_LINE_5,
    site_id: SITE_SOUTH,
    name: 'Кабельная линия КЛ-35',
    type: 'sensor',
    serial_number: 'DEMO-C-05',
    latitude: 54.529,
    longitude: 36.281,
    status: 'operational',
    installed_at: '2024-05-18',
  },
  {
    id: SUBSTATION_12,
    site_id: SITE_NORTH,
    name: 'Подстанция П-12',
    type: 'substation',
    serial_number: 'DEMO-SS-12',
    latitude: 56.021,
    longitude: 37.972,
    status: 'operational',
    installed_at: '2018-09-30',
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
  {
    id: id(35),
    equipment_id: CABLE_LINE_5,
    title: 'Прогрев кабельной линии',
    description: 'Участок КЛ-35 у КТП-214, сопротивление изоляции ниже нормы',
    priority: 'medium',
    status: 'new',
    planned_at: '2026-09-25T08:00:00.000Z',
    author: 'seed',
    closed_at: null,
    created_at: '2026-09-20T07:40:00.000Z',
    updated_at: '2026-09-20T07:40:00.000Z',
  },
  {
    id: id(36),
    equipment_id: SUBSTATION_12,
    title: 'Замена предохранителей',
    description: 'Прогорел предохранитель фазы B на РУ-10 кВ',
    priority: 'high',
    status: 'in_progress',
    planned_at: '2026-09-24T06:00:00.000Z',
    author: 'seed',
    closed_at: null,
    created_at: '2026-09-14T09:15:00.000Z',
    updated_at: '2026-09-21T08:05:00.000Z',
  },
  {
    id: id(37),
    equipment_id: TURBINE_1,
    title: 'Плановое ТО турбины',
    description: 'Квартальное обслуживание редуктора и тормозной системы',
    priority: 'low',
    status: 'done',
    planned_at: '2026-06-18T07:00:00.000Z',
    author: 'seed',
    closed_at: '2026-06-18T14:30:00.000Z',
    created_at: '2026-06-10T10:00:00.000Z',
    updated_at: '2026-06-18T14:30:00.000Z',
  },
  {
    id: id(38),
    equipment_id: SENSOR_7,
    title: 'Юстировка датчика вибрации',
    description: 'Показания датчика ушли за пределы допуска',
    priority: 'medium',
    status: 'done',
    planned_at: '2026-07-02T09:00:00.000Z',
    author: 'seed',
    closed_at: '2026-07-03T11:20:00.000Z',
    created_at: '2026-06-28T08:30:00.000Z',
    updated_at: '2026-07-03T11:20:00.000Z',
  },
  {
    id: id(39),
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
    id: id(40),
    equipment_id: TURBINE_1,
    title: 'Замена щёток генератора',
    description: 'Износ щёток 80 %, падает выработка',
    priority: 'medium',
    status: 'in_progress',
    planned_at: '2026-09-26T05:00:00.000Z',
    author: 'seed',
    closed_at: null,
    created_at: '2026-09-10T12:00:00.000Z',
    updated_at: '2026-09-22T07:45:00.000Z',
  },
  {
    id: id(41),
    equipment_id: SENSOR_7,
    title: 'Калибровка датчика',
    description: 'Плановая калибровка по эталону',
    priority: 'low',
    status: 'new',
    planned_at: '2026-10-01T08:00:00.000Z',
    author: 'seed',
    closed_at: null,
    created_at: '2026-09-18T09:00:00.000Z',
    updated_at: '2026-09-18T09:00:00.000Z',
  },
  {
    id: id(42),
    equipment_id: SUBSTATION_9,
    title: 'Проверка заземления',
    description: 'Периодический контроль сопротивления заземляющего контура',
    priority: 'medium',
    status: 'done',
    planned_at: '2026-05-12T10:00:00.000Z',
    author: 'seed',
    closed_at: '2026-05-13T16:00:00.000Z',
    created_at: '2026-05-05T09:00:00.000Z',
    updated_at: '2026-05-13T16:00:00.000Z',
  },
  {
    id: id(43),
    equipment_id: INVERTER_3,
    title: 'Чистка вентиляторов',
    description: 'Шум вентилятора охлаждения, температура растёт',
    priority: 'low',
    status: 'new',
    planned_at: '2026-10-05T08:00:00.000Z',
    author: 'seed',
    closed_at: null,
    created_at: '2026-09-19T13:20:00.000Z',
    updated_at: '2026-09-19T13:20:00.000Z',
  },
  {
    id: id(44),
    equipment_id: CABLE_LINE_5,
    title: 'Маркировка кабеля',
    description: 'Восстановление маркировки на опоре О-14',
    priority: 'low',
    status: 'done',
    planned_at: '2026-04-20T08:00:00.000Z',
    author: 'seed',
    closed_at: '2026-04-21T10:10:00.000Z',
    created_at: '2026-04-15T08:00:00.000Z',
    updated_at: '2026-04-21T10:10:00.000Z',
  },
  {
    id: id(45),
    equipment_id: SUBSTATION_12,
    title: 'Замена Трансформатора',
    description: 'Трансформатор ТМГ-1000 выработал ресурс',
    priority: 'critical',
    status: 'in_progress',
    planned_at: '2026-09-30T06:00:00.000Z',
    author: 'seed',
    closed_at: null,
    created_at: '2026-09-05T07:00:00.000Z',
    updated_at: '2026-09-23T06:30:00.000Z',
  },
  {
    id: id(46),
    equipment_id: TURBINE_1,
    title: 'Осмотр лопастей',
    description: 'После шторма: осмотр и дефектоскопия лопасти Б',
    priority: 'high',
    status: 'in_progress',
    planned_at: '2026-09-27T07:00:00.000Z',
    author: 'seed',
    closed_at: null,
    created_at: '2026-09-16T18:00:00.000Z',
    updated_at: '2026-09-24T09:00:00.000Z',
  },
  {
    id: id(47),
    equipment_id: SENSOR_7,
    title: 'Замена кабеля датчика',
    description: 'Механическое повреждение кабеля в коробе',
    priority: 'medium',
    status: 'rejected',
    planned_at: null,
    author: 'seed',
    closed_at: '2026-02-11T12:00:00.000Z',
    created_at: '2026-02-09T09:30:00.000Z',
    updated_at: '2026-02-11T12:00:00.000Z',
  },
  {
    id: id(48),
    equipment_id: INVERTER_3,
    title: 'Настройка MPP-трекинга',
    description: 'Смещение максимума мощности на 12 %',
    priority: 'medium',
    status: 'new',
    planned_at: '2026-10-08T08:00:00.000Z',
    author: 'seed',
    closed_at: null,
    created_at: '2026-09-21T11:45:00.000Z',
    updated_at: '2026-09-21T11:45:00.000Z',
  },
  {
    id: id(49),
    equipment_id: SUBSTATION_9,
    title: 'Замена масла в РУ',
    description: 'Уровень масла ниже нормы в распределительном устройстве',
    priority: 'low',
    status: 'new',
    planned_at: '2026-10-12T08:00:00.000Z',
    author: 'seed',
    closed_at: null,
    created_at: '2026-09-22T14:00:00.000Z',
    updated_at: '2026-09-22T14:00:00.000Z',
  },
  {
    id: id(50),
    equipment_id: CABLE_LINE_5,
    title: 'Ремонт муфты',
    description: 'Протечка в муфте на участке КЛ-35',
    priority: 'high',
    status: 'rejected',
    planned_at: null,
    author: 'seed',
    closed_at: '2026-03-05T15:30:00.000Z',
    created_at: '2026-03-02T08:00:00.000Z',
    updated_at: '2026-03-05T15:30:00.000Z',
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
  { id: id(51), request_id: id(35), previous_status: null, new_status: 'new', changed_by: 'seed', comment: 'Создана планировщиком', changed_at: '2026-09-20T07:40:00.000Z' },
  { id: id(52), request_id: id(36), previous_status: null, new_status: 'new', changed_by: 'seed', comment: 'Создана планировщиком', changed_at: '2026-09-14T09:15:00.000Z' },
  { id: id(53), request_id: id(36), previous_status: 'new', new_status: 'in_progress', changed_by: 'Планировщик ТО', comment: 'Бригада приступила', changed_at: '2026-09-21T08:05:00.000Z' },
  { id: id(54), request_id: id(37), previous_status: null, new_status: 'new', changed_by: 'seed', comment: 'Создана планировщиком', changed_at: '2026-06-10T10:00:00.000Z' },
  { id: id(55), request_id: id(37), previous_status: 'new', new_status: 'in_progress', changed_by: 'Планировщик ТО', comment: 'Бригада приступила', changed_at: '2026-06-18T14:30:00.000Z' },
  { id: id(56), request_id: id(37), previous_status: 'in_progress', new_status: 'done', changed_by: 'Планировщик ТО', comment: 'Работы завершены', changed_at: '2026-06-18T14:30:00.000Z' },
  { id: id(57), request_id: id(38), previous_status: null, new_status: 'new', changed_by: 'seed', comment: 'Создана планировщиком', changed_at: '2026-06-28T08:30:00.000Z' },
  { id: id(58), request_id: id(38), previous_status: 'new', new_status: 'in_progress', changed_by: 'Планировщик ТО', comment: 'Бригада приступила', changed_at: '2026-07-03T11:20:00.000Z' },
  { id: id(59), request_id: id(38), previous_status: 'in_progress', new_status: 'done', changed_by: 'Планировщик ТО', comment: 'Работы завершены', changed_at: '2026-07-03T11:20:00.000Z' },
  { id: id(60), request_id: id(39), previous_status: null, new_status: 'new', changed_by: 'seed', comment: 'Создана планировщиком', changed_at: '2026-01-15T10:00:00.000Z' },
  { id: id(61), request_id: id(39), previous_status: 'new', new_status: 'rejected', changed_by: 'Планировщик ТО', comment: 'Работы признаны ненужными', changed_at: '2026-01-16T11:00:00.000Z' },
  { id: id(62), request_id: id(40), previous_status: null, new_status: 'new', changed_by: 'seed', comment: 'Создана планировщиком', changed_at: '2026-09-10T12:00:00.000Z' },
  { id: id(63), request_id: id(40), previous_status: 'new', new_status: 'in_progress', changed_by: 'Планировщик ТО', comment: 'Бригада приступила', changed_at: '2026-09-22T07:45:00.000Z' },
  { id: id(64), request_id: id(41), previous_status: null, new_status: 'new', changed_by: 'seed', comment: 'Создана планировщиком', changed_at: '2026-09-18T09:00:00.000Z' },
  { id: id(65), request_id: id(42), previous_status: null, new_status: 'new', changed_by: 'seed', comment: 'Создана планировщиком', changed_at: '2026-05-05T09:00:00.000Z' },
  { id: id(66), request_id: id(42), previous_status: 'new', new_status: 'in_progress', changed_by: 'Планировщик ТО', comment: 'Бригада приступила', changed_at: '2026-05-13T16:00:00.000Z' },
  { id: id(67), request_id: id(42), previous_status: 'in_progress', new_status: 'done', changed_by: 'Планировщик ТО', comment: 'Работы завершены', changed_at: '2026-05-13T16:00:00.000Z' },
  { id: id(68), request_id: id(43), previous_status: null, new_status: 'new', changed_by: 'seed', comment: 'Создана планировщиком', changed_at: '2026-09-19T13:20:00.000Z' },
  { id: id(69), request_id: id(44), previous_status: null, new_status: 'new', changed_by: 'seed', comment: 'Создана планировщиком', changed_at: '2026-04-15T08:00:00.000Z' },
  { id: id(70), request_id: id(44), previous_status: 'new', new_status: 'in_progress', changed_by: 'Планировщик ТО', comment: 'Бригада приступила', changed_at: '2026-04-21T10:10:00.000Z' },
  { id: id(71), request_id: id(44), previous_status: 'in_progress', new_status: 'done', changed_by: 'Планировщик ТО', comment: 'Работы завершены', changed_at: '2026-04-21T10:10:00.000Z' },
  { id: id(72), request_id: id(45), previous_status: null, new_status: 'new', changed_by: 'seed', comment: 'Создана планировщиком', changed_at: '2026-09-05T07:00:00.000Z' },
  { id: id(73), request_id: id(45), previous_status: 'new', new_status: 'in_progress', changed_by: 'Планировщик ТО', comment: 'Бригада приступила', changed_at: '2026-09-23T06:30:00.000Z' },
  { id: id(74), request_id: id(46), previous_status: null, new_status: 'new', changed_by: 'seed', comment: 'Создана планировщиком', changed_at: '2026-09-16T18:00:00.000Z' },
  { id: id(75), request_id: id(46), previous_status: 'new', new_status: 'in_progress', changed_by: 'Планировщик ТО', comment: 'Бригада приступила', changed_at: '2026-09-24T09:00:00.000Z' },
  { id: id(76), request_id: id(47), previous_status: null, new_status: 'new', changed_by: 'seed', comment: 'Создана планировщиком', changed_at: '2026-02-09T09:30:00.000Z' },
  { id: id(77), request_id: id(47), previous_status: 'new', new_status: 'rejected', changed_by: 'Планировщик ТО', comment: 'Работы признаны ненужными', changed_at: '2026-02-11T12:00:00.000Z' },
  { id: id(78), request_id: id(48), previous_status: null, new_status: 'new', changed_by: 'seed', comment: 'Создана планировщиком', changed_at: '2026-09-21T11:45:00.000Z' },
  { id: id(79), request_id: id(49), previous_status: null, new_status: 'new', changed_by: 'seed', comment: 'Создана планировщиком', changed_at: '2026-09-22T14:00:00.000Z' },
  { id: id(80), request_id: id(50), previous_status: null, new_status: 'new', changed_by: 'seed', comment: 'Создана планировщиком', changed_at: '2026-03-02T08:00:00.000Z' },
  { id: id(81), request_id: id(50), previous_status: 'new', new_status: 'rejected', changed_by: 'Планировщик ТО', comment: 'Работы признаны ненужными', changed_at: '2026-03-05T15:30:00.000Z' },
];

// Учётные записи для демо-стенда. Пароли берутся только из переменных
// окружения: в репозитории их нет, а хеши вычисляются на лету.
const SEED_USERS = [
  {
    id: id(61),
    email: config.BOOTSTRAP_ADMIN_EMAIL,
    password: config.BOOTSTRAP_ADMIN_PASSWORD,
    full_name: 'Администратор системы',
    role: 'admin',
    technician_id: null,
    is_active: true,
    token_version: 1,
  },
  {
    id: id(62),
    email: config.SEED_TECHNICIAN_EMAIL,
    password: config.SEED_TECHNICIAN_PASSWORD,
    full_name: 'Иванов Иван Иванович',
    role: 'technician',
    technician_id: TECHNICIAN_TURBINE,
    is_active: true,
    token_version: 1,
  },
  {
    id: id(63),
    email: config.SEED_VIEWER_EMAIL,
    password: config.SEED_VIEWER_PASSWORD,
    full_name: 'Наблюдатель',
    role: 'viewer',
    technician_id: null,
    is_active: true,
    token_version: 1,
  },
];

const ASSIGNEES = [
  { request_id: id(31), technician_id: TECHNICIAN_TURBINE, role: 'lead', planned_hours: 8 },
  { request_id: id(31), technician_id: TECHNICIAN_SENSOR, role: 'member', planned_hours: 6 },
  { request_id: id(32), technician_id: TECHNICIAN_SENSOR, role: 'lead', planned_hours: 2 },
  { request_id: id(34), technician_id: TECHNICIAN_TURBINE, role: 'lead', planned_hours: 4 },
  { request_id: id(36), technician_id: TECHNICIAN_SUBSTATION, role: 'lead', planned_hours: 6 },
  { request_id: id(37), technician_id: TECHNICIAN_TURBINE, role: 'lead', planned_hours: 6 },
  { request_id: id(38), technician_id: TECHNICIAN_SENSOR, role: 'lead', planned_hours: 6 },
  { request_id: id(40), technician_id: TECHNICIAN_TURBINE, role: 'lead', planned_hours: 6 },
  { request_id: id(42), technician_id: TECHNICIAN_SUBSTATION, role: 'lead', planned_hours: 6 },
  { request_id: id(44), technician_id: TECHNICIAN_CABLE, role: 'lead', planned_hours: 6 },
  { request_id: id(45), technician_id: TECHNICIAN_SUBSTATION, role: 'lead', planned_hours: 6 },
  { request_id: id(46), technician_id: TECHNICIAN_TURBINE, role: 'lead', planned_hours: 6 },
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

async function seedUsers(sequelize: Sequelize, transaction: Transaction): Promise<number> {
  const rows = SEED_USERS.filter((user) => user.password !== '');
  const skipped = SEED_USERS.length - rows.length;
  if (skipped > 0) {
    logger.warn({ skipped }, 'часть демо-пользователей пропущена: не задан пароль в переменной окружения');
  }
  if (rows.length === 0) return 0;

  const queryInterface = sequelize.getQueryInterface();
  let inserted = 0;

  for (const row of rows) {
    const { password, ...rest } = row;
    const sql = `INSERT INTO ${queryInterface.quoteIdentifier('users')} (email, password_hash, full_name, role, technician_id, is_active, token_version) VALUES (:email, :passwordHash, :fullName, :role, :technicianId, :isActive, :tokenVersion) ON CONFLICT ON CONSTRAINT users_email_key DO NOTHING RETURNING id;`;

    const result = await sequelize.query<Record<string, unknown>>(sql, {
      replacements: {
        email: rest.email,
        passwordHash: await hashPassword(password),
        fullName: rest.full_name,
        role: rest.role,
        technicianId: rest.technician_id,
        isActive: rest.is_active,
        tokenVersion: rest.token_version,
      },
      type: QueryTypes.SELECT,
      transaction,
    });

    inserted += result.length;
  }

  return inserted;
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

  // Пользователи идут после справочников: у техника есть внешний ключ
  // на technicians, поэтому специалисты должны существовать раньше.
  if (config.SEED_USERS) {
    const users = await sequelize.transaction((transaction) => seedUsers(sequelize, transaction));
    logger.info({ users }, users > 0 ? 'демо-пользователи загружены' : 'демо-пользователи уже были загружены');
  }
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
