import type { MigrationFn } from 'umzug';

import type { DbContext } from './context.js';
import { ENUM_TYPES } from './enum-types.js';

function enumLiteral(value: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) {
    throw new Error(`недопустимое значение типа перечисления: ${value}`);
  }
  return `'${value}'`;
}

export const up: MigrationFn<DbContext> = async ({ context }) => {
  const statements = ENUM_TYPES.map(
    ({ name, values }) =>
      `CREATE TYPE ${name} AS ENUM (${values.map(enumLiteral).join(', ')});`,
  );
  await context.queryInterface.sequelize.query(statements.join('\n'));
};

export const down: MigrationFn<DbContext> = async ({ context }) => {
  const statements = [...ENUM_TYPES].reverse().map(({ name }) => `DROP TYPE ${name};`);
  await context.queryInterface.sequelize.query(statements.join('\n'));
};
