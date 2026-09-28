import type { MigrationFn } from 'umzug';

import type { DbContext } from './context.js';

export const up: MigrationFn<DbContext> = async ({ context }) => {
  await context.queryInterface.sequelize.query(`
    CREATE TABLE equipment_passports (
      equipment_id uuid PRIMARY KEY REFERENCES equipment (id) ON DELETE CASCADE,
      manufacturer text NOT NULL,
      model text NOT NULL,
      rated_power_kw double precision NOT NULL,
      last_verified_at date,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT equipment_passports_rated_power_kw_check CHECK (rated_power_kw > 0)
    );
  `);
};

export const down: MigrationFn<DbContext> = async ({ context }) => {
  await context.queryInterface.sequelize.query('DROP TABLE equipment_passports;');
};
