import { randomUUID } from 'node:crypto';

import { QueryTypes, type Sequelize } from 'sequelize';

import { logger } from '../../lib/logger.js';
import { createSequelize, waitForDatabase } from '../client.js';
import {
  EquipmentModel,
  MaintenanceRequestModel,
  RequestAssigneeModel,
  RequestStatusHistoryModel,
  SiteModel,
  TechnicianModel,
  initModels,
} from '../models/index.js';

const DEMO_CODE = 'SITE-ROLLBACK-DEMO';
const DEMO_SERIAL = 'SN-ROLLBACK-DEMO';
const DEMO_PERSONNEL = 'ROLLBACK-DEMO-1';
const DEMO_TAG = 'ROLLBACK-DEMO';

interface Snapshot {
  sites: number;
  equipment: number;
  requests: number;
  history: number;
  assignees: number;
}

interface Scenario {
  title: string;
  passed: boolean;
  detail: string;
}

class DemoError extends Error {}

async function snapshot(sequelize: Sequelize): Promise<Snapshot> {
  const [sites, equipment, requests, history, assignees] = await Promise.all([
    SiteModel.count(),
    EquipmentModel.count(),
    MaintenanceRequestModel.count(),
    RequestStatusHistoryModel.count(),
    RequestAssigneeModel.count(),
  ]);
  return { sites, equipment, requests, history, assignees };
}

function format(s: Snapshot): string {
  return `sites=${s.sites} equipment=${s.equipment} requests=${s.requests} history=${s.history} assignees=${s.assignees}`;
}

function unchanged(before: Snapshot, after: Snapshot): boolean {
  return (
    before.sites === after.sites &&
    before.equipment === after.equipment &&
    before.requests === after.requests &&
    before.history === after.history &&
    before.assignees === after.assignees
  );
}

async function cleanup(sequelize: Sequelize): Promise<void> {
  const equipment = await EquipmentModel.findOne({ where: { serialNumber: DEMO_SERIAL } });
  if (equipment) {
    const { id: equipmentId } = equipment;
    const requests = await MaintenanceRequestModel.findAll({ where: { equipmentId } });
    const requestIds = requests.map((request) => request.id);
    if (requestIds.length > 0) {
      await RequestAssigneeModel.destroy({ where: { requestId: requestIds } });
      await RequestStatusHistoryModel.destroy({ where: { requestId: requestIds } });
      await MaintenanceRequestModel.destroy({ where: { id: requestIds } });
    }
    await EquipmentModel.destroy({ where: { id: equipmentId } });
  }
  await SiteModel.destroy({ where: { code: DEMO_CODE } });
  await TechnicianModel.destroy({ where: { personnelNumber: DEMO_PERSONNEL } });
}

interface Fixture {
  siteId: string;
  equipmentId: string;
  requestId: string;
  technicianId: string;
}

async function createFixture(sequelize: Sequelize): Promise<Fixture> {
  await cleanup(sequelize);

  return sequelize.transaction(async (transaction) => {
    const site = await SiteModel.create(
      {
        name: 'Площадка для демонстрации отката',
        code: DEMO_CODE,
        region: 'Демонстрационная область',
        latitude: 55.7558,
        longitude: 37.6173,
      },
      { transaction },
    );

    const equipment = await EquipmentModel.create(
      {
        siteId: site.id,
        name: 'Трансформатор демонстрации отката',
        type: 'inverter',
        serialNumber: DEMO_SERIAL,
        latitude: 55.7558,
        longitude: 37.6173,
        status: 'operational',
        installedAt: '2026-01-15',
      },
      { transaction },
    );

    const technician = await TechnicianModel.create(
      {
        fullName: 'Демонстратор Отката',
        specialization: 'diagnostics',
        personnelNumber: DEMO_PERSONNEL,
      },
      { transaction },
    );

    const request = await MaintenanceRequestModel.create(
      {
        equipmentId: equipment.id,
        title: 'Заявка для демонстрации отката',
        description: 'Фикстура проверки транзакций',
        priority: 'medium',
        plannedAt: new Date('2026-10-01T09:00:00.000Z'),
        author: 'rollback-demo',
      },
      { transaction },
    );

    await RequestStatusHistoryModel.create(
      {
        requestId: request.id,
        previousStatus: null,
        newStatus: 'new',
        changedBy: 'rollback-demo',
        comment: 'Заявка создана',
      },
      { transaction },
    );

    await RequestAssigneeModel.create(
      {
        requestId: request.id,
        technicianId: technician.id,
        role: 'lead',
        plannedHours: 4,
      },
      { transaction },
    );

    return {
      siteId: site.id,
      equipmentId: equipment.id,
      requestId: request.id,
      technicianId: technician.id,
    };
  });
}

async function scenarioImplicitRollback(sequelize: Sequelize): Promise<Scenario> {
  const before = await snapshot(sequelize);
  const siteId = randomUUID();
  const equipmentId = randomUUID();
  const requestId = randomUUID();
  let thrown = '';

  try {
    await sequelize.transaction(async (transaction) => {
      await SiteModel.create(
        {
          id: siteId,
          name: 'Площадка, которая не должна сохраниться',
          code: `SITE-ROLLBACK-${siteId.slice(0, 8)}`,
          region: 'Демонстрационная область',
          latitude: 55.7558,
          longitude: 37.6173,
        },
        { transaction },
      );

      await EquipmentModel.create(
        {
          id: equipmentId,
          siteId,
          name: 'Оборудование, которое не должно сохраниться',
          type: 'sensor',
          serialNumber: `SN-ROLLBACK-${siteId.slice(0, 8)}`,
          latitude: 55.7558,
          longitude: 37.6173,
          status: 'operational',
          installedAt: '2026-01-15',
        },
        { transaction },
      );

      await MaintenanceRequestModel.create(
        {
          id: requestId,
          equipmentId,
          title: 'Заявка, которая не должна сохраниться',
          description: 'Ошибка возникла после вставок',
          priority: 'high',
          plannedAt: new Date('2026-10-02T09:00:00.000Z'),
          author: 'rollback-demo',
        },
        { transaction },
      );

      await RequestStatusHistoryModel.create(
        {
          requestId,
          previousStatus: null,
          newStatus: 'new',
          changedBy: 'rollback-demo',
          comment: 'Запись должна исчезнуть',
        },
        { transaction },
      );

      throw new DemoError('сбой после четырёх вставок');
    });
  } catch (err) {
    thrown = err instanceof Error ? err.message : String(err);
  }

  const after = await snapshot(sequelize);
  const [orphanRow] = await sequelize.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM maintenance_requests WHERE id = :id',
    { replacements: { id: requestId }, type: QueryTypes.SELECT },
  );
  const orphans = orphanRow?.count ?? -1;

  const passed = unchanged(before, after) && thrown.startsWith('сбой') && orphans === 0;

  return {
    title: 'неявный откат: ошибка внутри transaction()',
    passed,
    detail: `ошибка «${thrown}», ${format(before)} -> ${format(after)}`,
  };
}

async function scenarioExplicitRollback(sequelize: Sequelize): Promise<Scenario> {
  const before = await snapshot(sequelize);
  const transaction = await sequelize.transaction();
  const requestId = randomUUID();

  await SiteModel.create(
    {
      name: 'Площадка, откатанная явно',
      code: `SITE-EXPLICIT-${requestId.slice(0, 8)}`,
      region: 'Демонстрационная область',
      latitude: 55.7558,
      longitude: 37.6173,
    },
    { transaction },
  );

  await MaintenanceRequestModel.create(
    {
      id: requestId,
      equipmentId: (
        await EquipmentModel.findOne({
          attributes: ['id'],
          order: [['createdAt', 'ASC']],
          transaction,
        })
      )!.id,
      title: 'Заявка, откатанная явно',
      description: 'Вызов rollback() без ошибки',
      priority: 'low',
      plannedAt: null,
      author: 'rollback-demo',
    },
    { transaction },
  );

  await transaction.rollback();

  const after = await snapshot(sequelize);

  return {
    title: 'явный откат: transaction.rollback() без ошибки',
    passed: unchanged(before, after),
    detail: `${format(before)} -> ${format(after)}`,
  };
}

async function scenarioPartialChange(sequelize: Sequelize, fixture: Fixture): Promise<Scenario> {
  const before = {
    request: await MaintenanceRequestModel.findByPk(fixture.requestId),
    history: await RequestStatusHistoryModel.count({ where: { requestId: fixture.requestId } }),
    assignees: await RequestAssigneeModel.count({ where: { requestId: fixture.requestId } }),
  };
  let thrown = '';

  try {
    await sequelize.transaction(async (transaction) => {
      await MaintenanceRequestModel.update(
        { status: 'in_progress' },
        { where: { id: fixture.requestId }, transaction },
      );

      await RequestStatusHistoryModel.create(
        {
          requestId: fixture.requestId,
          previousStatus: 'new',
          newStatus: 'in_progress',
          changedBy: 'rollback-demo',
          comment: 'Переход должен исчезнуть',
        },
        { transaction },
      );

      await RequestAssigneeModel.destroy({
        where: { requestId: fixture.requestId, technicianId: fixture.technicianId },
        transaction,
      });

      throw new DemoError('сбой после смены статуса, записи истории и удаления исполнителя');
    });
  } catch (err) {
    thrown = err instanceof Error ? err.message : String(err);
  }

  const after = {
    status: (await MaintenanceRequestModel.findByPk(fixture.requestId))?.status,
    history: await RequestStatusHistoryModel.count({ where: { requestId: fixture.requestId } }),
    assignees: await RequestAssigneeModel.count({ where: { requestId: fixture.requestId } }),
  };

  const passed =
    thrown.startsWith('сбой') &&
    before.request?.status === 'new' &&
    after.status === 'new' &&
    after.history === before.history &&
    after.assignees === before.assignees;

  return {
    title: 'откат частичной операции: UPDATE + INSERT + DELETE в одной транзакции',
    passed,
    detail: `ошибка «${thrown}», статус ${before.request?.status} -> ${after.status}, история ${before.history} -> ${after.history}, исполнители ${before.assignees} -> ${after.assignees}`,
  };
}

async function main(): Promise<void> {
  const sequelize = createSequelize('app');
  try {
    await waitForDatabase(sequelize);
    initModels(sequelize);

    await cleanup(sequelize);
    const baseline = await snapshot(sequelize);
    logger.info({ строки: format(baseline) }, 'база после очистки фикстуры');

    const fixture = await createFixture(sequelize);
    const scenarios: Scenario[] = [
      await scenarioImplicitRollback(sequelize),
      await scenarioExplicitRollback(sequelize),
      await scenarioPartialChange(sequelize, fixture),
    ];

    await cleanup(sequelize);
    const finalSnapshot = await snapshot(sequelize);
    const restored = unchanged(baseline, finalSnapshot);

    logger.info(
      { строки: format(finalSnapshot) },
      restored ? 'фикстура удалена, база вернулась к исходному состоянию' : 'база не совпадает с исходным состоянием',
    );

    for (const scenario of scenarios) {
      logger.info(
        { сценарий: scenario.title, результат: scenario.passed ? 'откат подтверждён' : 'ПРОВАЛ' },
        scenario.detail,
      );
    }

    const failed = scenarios.filter((scenario) => !scenario.passed).length;
    if (failed === 0 && restored) {
      logger.info(
        { сценариев: scenarios.length, строки: format(finalSnapshot) },
        'все сценарии отката подтверждены',
      );
      return;
    }

    process.exitCode = 1;
    logger.error({ провалов: failed, базаВосстановлена: restored }, 'демонстрация отката не пройдена');
  } finally {
    await sequelize.close();
  }
}

await main();
