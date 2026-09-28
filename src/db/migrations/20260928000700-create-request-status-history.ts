import type { MigrationFn } from 'umzug';

import type { DbContext } from './context.js';

export const up: MigrationFn<DbContext> = async ({ context }) => {
  await context.queryInterface.sequelize.query(`
    CREATE TABLE request_status_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id uuid NOT NULL REFERENCES maintenance_requests (id) ON DELETE CASCADE,
      previous_status request_status,
      new_status request_status NOT NULL,
      changed_by text,
      comment text,
      changed_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT request_status_history_transition_check CHECK (
        previous_status IS NULL OR previous_status <> new_status
      )
    );

    CREATE INDEX request_status_history_request_changed_idx
      ON request_status_history (request_id, changed_at DESC);
    CREATE INDEX request_status_history_changed_at_idx
      ON request_status_history (changed_at DESC);

    CREATE FUNCTION forbid_status_history_update() RETURNS trigger AS $body$
    BEGIN
      RAISE EXCEPTION 'request_status_history is append-only: % is forbidden', TG_OP
        USING ERRCODE = '23514';
    END;
    $body$ LANGUAGE plpgsql;

    CREATE TRIGGER request_status_history_no_update
      BEFORE UPDATE ON request_status_history
      FOR EACH ROW EXECUTE FUNCTION forbid_status_history_update();
  `);
};

export const down: MigrationFn<DbContext> = async ({ context }) => {
  await context.queryInterface.sequelize.query(`
    DROP TRIGGER request_status_history_no_update ON request_status_history;
    DROP FUNCTION forbid_status_history_update();
    DROP TABLE request_status_history;
  `);
};
