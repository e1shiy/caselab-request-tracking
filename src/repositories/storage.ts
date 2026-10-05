import type { Sequelize } from 'sequelize';

import { createSequelize, waitForDatabase } from '../db/client.js';
import type { TransactionRunner } from './common.js';
import { initModels } from '../db/models/index.js';
import type { EquipmentRepository } from './equipment-repository.js';
import { PostgresEquipmentRepository } from './postgres/equipment-repository.js';
import { PostgresReportRepository } from './postgres/report-repository.js';
import { PostgresRequestRepository } from './postgres/request-repository.js';
import { PostgresSiteRepository } from './postgres/site-repository.js';
import type { ReportRepository } from './report-repository.js';
import type { RequestRepository } from './request-repository.js';
import type { SiteRepository } from './site-repository.js';
import type { UserRepository } from './user-repository.js';
import { PostgresUserRepository } from './postgres/user-repository.js';

export interface Storage {
  equipment: EquipmentRepository;
  requests: RequestRepository;
  reports: ReportRepository;
  sites: SiteRepository;
  users: UserRepository;
  transaction: TransactionRunner;
  /** Проверка живости соединения с PostgreSQL для /api/health/ready. */
  health(): Promise<void>;
  close(): Promise<void>;
}

export async function createStorage(): Promise<Storage> {
  const sequelize: Sequelize = createSequelize('app');

  await waitForDatabase(sequelize);
  initModels(sequelize);

  const runInTransaction: TransactionRunner = (action) =>
    sequelize.transaction((transaction) => action(transaction));

  return {
    equipment: new PostgresEquipmentRepository(sequelize),
    requests: new PostgresRequestRepository(),
    reports: new PostgresReportRepository(sequelize),
    sites: new PostgresSiteRepository(sequelize),
    users: new PostgresUserRepository(),
    transaction: runInTransaction,
    health: async () => {
      await sequelize.query('SELECT 1');
    },
    close: () => sequelize.close(),
  };
}
