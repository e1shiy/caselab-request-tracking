import type { MigrationFn } from 'umzug';

import type { DbContext } from './context.js';

export const up: MigrationFn<DbContext> = async ({ context }) => {
  await context.queryInterface.sequelize.query(`
    CREATE TABLE sites (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      code text NOT NULL,
      region text NOT NULL,
      latitude double precision NOT NULL,
      longitude double precision NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT sites_latitude_check CHECK (latitude >= -90 AND latitude <= 90),
      CONSTRAINT sites_longitude_check CHECK (longitude >= -180 AND longitude <= 180),
      CONSTRAINT sites_code_key UNIQUE (code)
    );

    CREATE INDEX sites_region_idx ON sites (region);
  `);
};

export const down: MigrationFn<DbContext> = async ({ context }) => {
  await context.queryInterface.sequelize.query('DROP TABLE sites;');
};
