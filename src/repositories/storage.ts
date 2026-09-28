import type { Sequelize } from 'sequelize';

import { createSequelize, waitForDatabase } from '../db/client.js';
import type { TransactionRunner } from './common.js';
import { initModels } from '../db/models/index.js';
import type { EquipmentRepository } from './equipment-repository.js';
import { PostgresEquipmentRepository } from './postgres/equipment-repository.js';
import { PostgresRequestRepository } from './postgres/request-repository.js';
import { PostgresSiteRepository } from './postgres/site-repository.js';
import type { RequestRepository } from './request-repository.js';
import type { SiteRepository } from './site-repository.js';

export interface Storage {
  equipment: EquipmentRepository;
  requests: RequestRepository;
  sites: SiteRepository;
  transaction: TransactionRunner;
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
    sites: new PostgresSiteRepository(sequelize),
    transaction: runInTransaction,
    close: () => sequelize.close(),
  };
}
