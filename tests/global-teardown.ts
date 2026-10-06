import { QueryTypes, Sequelize } from 'sequelize';

import 'dotenv/config';

const TEST_DB_NAME = process.env.TEST_DB_NAME ?? 'appdb_test';

// База остаётся на месте: удаление в teardown экономит время, а setup
// идемпотентен (CREATE DATABASE только если базы ещё нет, миграции докатываются).
// Пустая тестовая база никому не мешает, а её случайное использование
// обнаруживается по имени в строке подключения.
export default async function globalTeardown(): Promise<void> {
  const admin = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_MIGRATION_USER ?? 'postgres',
    password: process.env.DB_MIGRATION_PASSWORD ?? '',
    database: 'postgres',
    logging: false,
  });

  try {
    const rows = await admin.query<{ exists: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = :name) AS exists',
      { replacements: { name: TEST_DB_NAME }, type: QueryTypes.SELECT },
    );
    if (rows[0]?.exists) {
      process.stdout.write(
        `[tests] тестовая база ${TEST_DB_NAME} остаётся для следующих прогонов\n`,
      );
    }
  } finally {
    await admin.close();
  }
}