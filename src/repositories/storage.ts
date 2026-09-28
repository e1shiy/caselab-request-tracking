import type { Sequelize, Transaction } from 'sequelize';

import { createSequelize, waitForDatabase } from '../db/client.js';
import { initModels } from '../db/models/index.js';
import type { EquipmentRepository } from './equipment-repository.js';
import { PostgresEquipmentRepository } from './postgres/equipment-repository.js';
import { PostgresRequestRepository } from './postgres/request-repository.js';
import type { RequestRepository } from './request-repository.js';

export interface Storage {
  equipment: EquipmentRepository;
  requests: RequestRepository;
  transaction<T>(action: (transaction: Transaction) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function createStorage(): Promise<Storage> {
  const sequelize: Sequelize = createSequelize('app');

  await waitForDatabase(sequelize);
  initModels(sequelize);

  return {
    equipment: new PostgresEquipmentRepository(sequelize),
    requests: new PostgresRequestRepository(sequelize),
    transaction: (action) => sequelize.transaction((transaction) => action(transaction)),
    close: () => sequelize.close(),
  };
}
