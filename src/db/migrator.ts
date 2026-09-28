import { fileURLToPath } from 'node:url';

import type { Sequelize } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';

import { logger } from '../lib/logger.js';
import { createSequelize, waitForDatabase } from './client.js';
import type { DbContext } from './migrations/context.js';

const migrationsDir = fileURLToPath(new URL('migrations', import.meta.url));

const MIGRATION_GLOB = '[0-9]*.{ts,js}';

export function createMigrator(sequelize: Sequelize): Umzug<DbContext> {
  return new Umzug<DbContext>({
    migrations: { glob: [MIGRATION_GLOB, { cwd: migrationsDir }] },
    context: () => ({ queryInterface: sequelize.getQueryInterface() }),
    storage: new SequelizeStorage({ sequelize, modelName: 'umzug' }),
    logger: {
      info: (message) => {
        logger.info(message, 'umzug');
      },
      warn: (message) => {
        logger.warn(message, 'umzug');
      },
      error: (message) => {
        logger.error(message, 'umzug');
      },
      debug: () => {},
    },
  });
}

export type Migrator = Umzug<DbContext>;

export async function withMigrator<T>(action: (migrator: Migrator) => Promise<T>): Promise<T> {
  const sequelize = createSequelize('migration');
  try {
    await waitForDatabase(sequelize);
    return await action(createMigrator(sequelize));
  } finally {
    await sequelize.close();
  }
}
