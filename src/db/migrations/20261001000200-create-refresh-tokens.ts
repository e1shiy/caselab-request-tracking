import type { MigrationFn } from 'umzug';

import type { DbContext } from './context.js';

export const up: MigrationFn<DbContext> = async ({ context }) => {
  await context.queryInterface.sequelize.query(`
    CREATE TABLE refresh_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      token_version integer NOT NULL,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT refresh_tokens_token_version_check CHECK (token_version >= 0)
    );

    CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens (user_id);
    CREATE INDEX refresh_tokens_expires_at_idx ON refresh_tokens (expires_at);
  `);
};

export const down: MigrationFn<DbContext> = async ({ context }) => {
  await context.queryInterface.sequelize.query('DROP TABLE refresh_tokens;');
};