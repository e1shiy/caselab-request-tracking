import type { MigrationFn } from 'umzug';

import type { DbContext } from './context.js';

export const up: MigrationFn<DbContext> = async ({ context }) => {
  await context.queryInterface.sequelize.query(`
    CREATE TABLE maintenance_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      equipment_id uuid NOT NULL REFERENCES equipment (id) ON DELETE CASCADE,
      title text NOT NULL,
      description text NOT NULL,
      priority request_priority NOT NULL,
      status request_status NOT NULL DEFAULT 'new',
      planned_at timestamptz,
      author text NOT NULL,
      closed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT maintenance_requests_closed_at_check CHECK (
        (status IN ('done', 'rejected')) = (closed_at IS NOT NULL)
      )
    );

    CREATE INDEX maintenance_requests_equipment_id_idx ON maintenance_requests (equipment_id);
    CREATE INDEX maintenance_requests_status_idx ON maintenance_requests (status);
    CREATE INDEX maintenance_requests_priority_idx ON maintenance_requests (priority);
    CREATE INDEX maintenance_requests_created_at_idx ON maintenance_requests (created_at DESC);
  `);
};

export const down: MigrationFn<DbContext> = async ({ context }) => {
  await context.queryInterface.sequelize.query('DROP TABLE maintenance_requests;');
};
