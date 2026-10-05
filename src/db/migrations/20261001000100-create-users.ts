import type { MigrationFn } from 'umzug';

import type { DbContext } from './context.js';

export const up: MigrationFn<DbContext> = async ({ context }) => {
  // Тип user_role создаётся здесь, а не в 20260928000100: применённые миграции
  // не переписываются, поэтому их содержимое остаётся неизменным.
  await context.queryInterface.sequelize.query(`
    CREATE TYPE user_role AS ENUM ('viewer', 'technician', 'admin');

    CREATE TABLE users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL,
      password_hash text NOT NULL,
      full_name text NOT NULL,
      role user_role NOT NULL DEFAULT 'viewer',
      technician_id uuid REFERENCES technicians (id) ON DELETE SET NULL,
      token_version integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT users_email_key UNIQUE (email),
      CONSTRAINT users_token_version_check CHECK (token_version >= 0)
    );

    CREATE UNIQUE INDEX users_technician_id_key ON users (technician_id) WHERE technician_id IS NOT NULL;
    CREATE INDEX users_role_idx ON users (role);
  `);
};

export const down: MigrationFn<DbContext> = async ({ context }) => {
  await context.queryInterface.sequelize.query(`
    DROP TABLE users;
    DROP TYPE user_role;
  `);
};