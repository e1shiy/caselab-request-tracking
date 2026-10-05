import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { QueryTypes, Sequelize } from 'sequelize';

import 'dotenv/config';

const TEST_DB_NAME = process.env.TEST_DB_NAME ?? 'appdb_test';

// Пул нужен только для CREATE/DROP DATABASE: до самой базы подключиться нельзя.
const adminDatabase = 'postgres';

function migrationCredentials() {
  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_MIGRATION_USER ?? 'postgres',
    password: process.env.DB_MIGRATION_PASSWORD ?? '',
    database: adminDatabase,
    logging: false,
  };
}

async function databaseExists(sequelize: Sequelize): Promise<boolean> {
  const rows = await sequelize.query<{ exists: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = :name) AS exists',
    { replacements: { name: TEST_DB_NAME }, type: QueryTypes.SELECT },
  );
  return rows[0]?.exists ?? false;
}

function runMigrationsCli(...args: string[]): void {
  // Миграции запускаем тем же CLI, что и в контейнере: отдельная реализация
  // в setup-файле разошлась бы с рабочей при первом же новом скрипте.
  const tsxCli = fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url));
  execFileSync(process.execPath, [tsxCli, 'src/db/cli/migrate.ts', ...args], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, NODE_ENV: 'test', DB_NAME: TEST_DB_NAME },
    stdio: 'pipe',
  });
}

export default async function globalSetup(): Promise<void> {
  const admin = new Sequelize({ ...migrationCredentials(), dialect: 'postgres' });
  try {
    if (!(await databaseExists(admin))) {
      await admin.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
      process.stdout.write(`\n[tests] создана тестовая база ${TEST_DB_NAME}\n`);
    }
  } finally {
    await admin.close();
  }

  runMigrationsCli('up');
  process.stdout.write(`[tests] миграции применены в ${TEST_DB_NAME}\n`);
}