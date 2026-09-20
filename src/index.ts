import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { createStorage } from './repositories/storage.js';

async function bootstrap(): Promise<void> {
  const storage = await createStorage();
  const app = createApp(storage);

  const server = app.listen(config.PORT, config.HOST, () => {
    logger.info({ host: config.HOST, port: config.PORT, env: config.NODE_ENV }, 'server started');
  });

  function shutdown(reason: string, err?: unknown): void {
    logger.fatal({ err, reason }, 'shutting down');

    server.close((closeErr) => {
      if (closeErr) logger.error({ err: closeErr }, 'error while closing server');
      process.exit(1);
    });

    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on('uncaughtException', (err) => shutdown('uncaughtException', err));
  process.on('unhandledRejection', (err) => shutdown('unhandledRejection', err));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'failed to start server');
  process.exit(1);
});