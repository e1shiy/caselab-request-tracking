import type { MigrationFn } from 'umzug';

import type { DbContext } from './context.js';

export const up: MigrationFn<DbContext> = async ({ context }) => {
  await context.queryInterface.sequelize.query(`
    CREATE TABLE equipment (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id uuid REFERENCES sites (id) ON DELETE RESTRICT,
      name text NOT NULL,
      type equipment_type NOT NULL,
      serial_number text NOT NULL,
      latitude double precision NOT NULL,
      longitude double precision NOT NULL,
      status equipment_status NOT NULL DEFAULT 'operational',
      installed_at date NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT equipment_latitude_check CHECK (latitude >= -90 AND latitude <= 90),
      CONSTRAINT equipment_longitude_check CHECK (longitude >= -180 AND longitude <= 180),
      CONSTRAINT equipment_serial_number_key UNIQUE (serial_number)
    );

    CREATE INDEX equipment_site_id_idx ON equipment (site_id);
    CREATE INDEX equipment_status_idx ON equipment (status);
    CREATE INDEX equipment_type_idx ON equipment (type);
  `);
};

export const down: MigrationFn<DbContext> = async ({ context }) => {
  await context.queryInterface.sequelize.query('DROP TABLE equipment;');
};
