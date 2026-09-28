import { Sequelize } from 'sequelize';
import pg from 'pg';

import { config } from '../config.js';
import { getLog } from '../lib/context.js';
import { logger } from '../lib/logger.js';

pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value: string) => Number(value));

pg.types.setTypeParser(pg.types.builtins.INT8, (value: string) => Number(value));

export type DbRole = 'app' | 'migration';

interface DbCredentials {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

function credentialsFor(role: DbRole): DbCredentials {
  if (role === 'migration') {
    return {
      host: config.DB_HOST,
      port: config.DB_PORT,
      database: config.DB_NAME,
      username: config.DB_MIGRATION_USER,
      password: config.DB_MIGRATION_PASSWORD,
    };
  }
  return {
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    username: config.DB_USER,
    password: config.DB_PASSWORD,
  };
}

export function createSequelize(role: DbRole): Sequelize {
  const credentials = credentialsFor(role);

  return new Sequelize({
    dialect: 'postgres',
    ...credentials,
    define: { underscored: true, freezeTableName: true },
    pool: {
      max: config.DB_POOL_MAX,
      idle: config.DB_POOL_IDLE_MS,
      acquire: config.DB_POOL_ACQUIRE_MS,
    },
    dialectOptions: {
      connectionTimeoutMillis: config.DB_POOL_ACQUIRE_MS,
      application_name: `caselab-requests (${role})`,
      options: '-c timezone=UTC',
    },
    logging: config.DB_LOG_QUERIES
      ? (sql: string) => {
          getLog().debug({ sql }, 'sql');
        }
      : false,
  });
}

export async function waitForDatabase(
  sequelize: Sequelize,
  { attempts = config.DB_CONNECT_RETRIES, baseDelayMs = config.DB_RETRY_BASE_DELAY_MS } = {},
): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await sequelize.authenticate();
      return;
    } catch (err) {
      if (attempt === attempts) throw err;
      const delay = baseDelayMs * attempt;
      logger.warn(
        { err, attempt, attempts, delay },
        'база недоступна, повтор подключения',
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
