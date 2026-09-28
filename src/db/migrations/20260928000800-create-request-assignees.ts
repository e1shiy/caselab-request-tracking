import type { MigrationFn } from 'umzug';

import type { DbContext } from './context.js';

export const up: MigrationFn<DbContext> = async ({ context }) => {
  await context.queryInterface.sequelize.query(`
    CREATE TABLE request_assignees (
      request_id uuid NOT NULL REFERENCES maintenance_requests (id) ON DELETE CASCADE,
      technician_id uuid NOT NULL REFERENCES technicians (id) ON DELETE RESTRICT,
      role assignee_role NOT NULL,
      planned_hours double precision,
      assigned_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (request_id, technician_id),
      CONSTRAINT request_assignees_planned_hours_check CHECK (
        planned_hours IS NULL OR planned_hours >= 0
      )
    );

    CREATE UNIQUE INDEX request_assignees_single_lead_idx
      ON request_assignees (request_id) WHERE role = 'lead';
    CREATE INDEX request_assignees_technician_id_idx ON request_assignees (technician_id);
  `);
};

export const down: MigrationFn<DbContext> = async ({ context }) => {
  await context.queryInterface.sequelize.query('DROP TABLE request_assignees;');
};
