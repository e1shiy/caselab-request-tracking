import { Router } from 'express';

import { EquipmentController } from '../controllers/equipment-controller.js';
import { validate } from '../middleware/validate.js';
import type { Storage } from '../repositories/index.js';
import {
  equipmentCreateSchema,
  equipmentListQuerySchema,
  equipmentUpdateSchema,
} from '../schemas/equipment.js';
import { idParamsSchema } from '../schemas/common.js';
import { EquipmentService } from '../services/equipment-service.js';

export function createEquipmentRouter(storage: Storage): Router {
  const service = new EquipmentService(storage.equipment, storage.requests);
  const controller = new EquipmentController(service);

  const router = Router();

  router.get('/', validate({ query: equipmentListQuerySchema }), controller.list);
  router.post('/', validate({ body: equipmentCreateSchema }), controller.create);
  router.get('/:id', validate({ params: idParamsSchema }), controller.getById);
  router.patch('/:id', validate({ params: idParamsSchema, body: equipmentUpdateSchema }), controller.update);
  router.delete('/:id', validate({ params: idParamsSchema }), controller.remove);

  return router;
}