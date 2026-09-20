import { Router } from 'express';

import type { Storage } from '../repositories/index.js';
import { createEquipmentRouter } from './equipment.js';

export function createApiRouter(storage: Storage): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.use('/equipment', createEquipmentRouter(storage));

  return router;
}