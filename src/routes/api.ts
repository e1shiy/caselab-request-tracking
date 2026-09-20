import { Router } from 'express';

import { RequestController } from '../controllers/request-controller.js';
import type { Storage } from '../repositories/index.js';
import { RequestService } from '../services/request-service.js';
import { createEquipmentRouter } from './equipment.js';
import { createRequestsRouter } from './requests.js';

export function createApiRouter(storage: Storage): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const requestService = new RequestService(storage.requests, storage.equipment);
  const requestController = new RequestController(requestService);

  router.use('/equipment', createEquipmentRouter(storage, requestController));
  router.use('/requests', createRequestsRouter(requestController));

  return router;
}