import type { Server } from 'node:http';

import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import type { Storage } from './repositories/storage.js';
import { createStorage } from './repositories/storage.js';

const SHUTDOWN_GRACE_MS = 10_000;

async function stopServer(server: Server, storage: Storage): Promise<void> {
  await new Promise<void>((resolve) => {
    server.close((err) => {
      if (err) logger.error({ err }, 'error while closing server');
      resolve();
    });
    server.closeIdleConnections?.();
  });

  await storage.close();
}

async function bootstrap(): Promise<void> {
  const storage = await createStorage();
  const app = createApp(storage);

  const server = app.listen(config.PORT, config.HOST, () => {
    logger.info({ host: config.HOST, port: config.PORT, env: config.NODE_ENV }, 'server started');
  });

  let stopping: Promise<void> | null = null;

  function shutdown(reason: string, code: number, err?: unknown): void {
    logger.fatal({ err, reason }, 'shutting down');

    stopping ??= stopServer(server, storage).finally(() => process.exit(code));
    setTimeout(() => process.exit(code), SHUTDOWN_GRACE_MS).unref();
  }

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => shutdown(signal, 0));
  }
  process.on('uncaughtException', (err) => shutdown('uncaughtException', 1, err));
  process.on('unhandledRejection', (err) => shutdown('unhandledRejection', 1, err));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'failed to start server');
  process.exit(1);
});
