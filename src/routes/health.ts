import { Router } from 'express';

import { ServiceUnavailableError } from '../errors.js';
import { asyncHandler } from '../lib/async-handler.js';
import { setDatabaseUp } from '../lib/metrics.js';
import type { Storage } from '../repositories/index.js';

/**
 * `/live` отвечает «процесс жив» и не ходит в базу: перезапуск при потере
 * связи с PostgreSQL ничего не даёт. `/ready` проверяет соединение — по нему
 * балансировщик решает, выпускать ли трафик на инстанс.
 */
export function createHealthRouter(storage: Storage): Router {
  const router = Router();

  // Исторический эндпоинт без проверки базы: оставлен для совместимости
  // с healthcheck-конфигурацией из предыдущей версии.
  router.get('/', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/live', (_req, res) => {
    res.json({
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  router.get(
    '/ready',
    asyncHandler(async (req, res) => {
      try {
        await storage.health();
      } catch (cause) {
        setDatabaseUp(false);
        req.log.warn({ err: cause }, 'database health check failed');

        // Детали соединения наружу не выходят: клиенту достаточно кода 503.
        throw new ServiceUnavailableError('База данных недоступна', { cause });
      }

      setDatabaseUp(true);

      res.json({
        status: 'ready',
        database: 'up',
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      });
    }),
  );

  return router;
}