import { logger } from '../../lib/logger.js';
import { withMigrator } from '../migrator.js';

type Command = 'up' | 'down' | 'reset' | 'status';

const COMMANDS: readonly Command[] = ['up', 'down', 'reset', 'status'];

async function main(): Promise<void> {
  const command = process.argv[2] as Command | undefined;

  if (!command || !COMMANDS.includes(command)) {
    logger.error({ command: process.argv[2] }, 'usage: migrate <up|down|reset|status>');
    process.exitCode = 1;
    return;
  }

  await withMigrator(async (migrator) => {
    switch (command) {
      case 'up': {
        const applied = await migrator.up();
        logger.info({ count: applied.length }, 'миграции применены');
        return;
      }
      case 'down': {
        const reverted = await migrator.down();
        logger.info({ count: reverted.length }, 'миграция откачена');
        return;
      }
      case 'reset': {
        const reverted = await migrator.down({ to: 0 });
        logger.info({ count: reverted.length }, 'схема очищена');
        return;
      }
      case 'status': {
        const [executed, pending] = await Promise.all([
          migrator.executed(),
          migrator.pending(),
        ]);
        logger.info({ executed: executed.map(({ name }) => name) }, 'применены');
        if (pending.length > 0) {
          logger.info({ pending: pending.map(({ name }) => name) }, 'ожидают применения');
        } else {
          logger.info('нет неприменённых миграций');
        }
        return;
      }
    }
  });
}

await main();
