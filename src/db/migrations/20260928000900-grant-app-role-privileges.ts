import type { MigrationFn } from 'umzug';

import { config } from '../../config.js';
import type { DbContext } from './context.js';
import { ENUM_TYPE_NAMES } from './enum-types.js';

export const up: MigrationFn<DbContext> = async ({ context }) => {
  const { queryInterface } = context;
  const { sequelize } = queryInterface;
  const role = queryInterface.quoteIdentifier(config.DB_USER);

  const statements = [
    `GRANT USAGE ON SCHEMA public TO ${role}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON TYPES TO ${role}`,
    ...ENUM_TYPE_NAMES.map(
      (name) => `GRANT USAGE ON TYPE ${queryInterface.quoteIdentifier(name)} TO ${role}`,
    ),
  ];

  for (const statement of statements) {
    await sequelize.query(statement);
  }
};

export const down: MigrationFn<DbContext> = async ({ context }) => {
  const { queryInterface } = context;
  const { sequelize } = queryInterface;
  const role = queryInterface.quoteIdentifier(config.DB_USER);

  const statements = [
    ...ENUM_TYPE_NAMES.map(
      (name) => `REVOKE USAGE ON TYPE ${queryInterface.quoteIdentifier(name)} FROM ${role}`,
    ),
    `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${role}`,
    `REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${role}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM ${role}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM ${role}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TYPES FROM ${role}`,
  ];

  for (const statement of statements) {
    await sequelize.query(statement);
  }

};
