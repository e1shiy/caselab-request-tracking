import { Router } from 'express';

import { EquipmentController } from '../controllers/equipment-controller.js';
import type { RequestController } from '../controllers/request-controller.js';
import type { WeatherController } from '../controllers/weather-controller.js';
import { validate } from '../middleware/validate.js';
import type { Storage } from '../repositories/index.js';
import { idParamsSchema } from '../schemas/common.js';
import {
  equipmentCreateSchema,
  equipmentListQuerySchema,
  equipmentUpdateSchema,
} from '../schemas/equipment.js';
import { requestListQuerySchema } from '../schemas/request.js';
import { EquipmentService } from '../services/equipment-service.js';

export function createEquipmentRouter(
  storage: Storage,
  requestController: RequestController,
  weatherController: WeatherController,
): Router {
  const service = new EquipmentService(storage.equipment, storage.requests);
  const controller = new EquipmentController(service);

  const router = Router();

  router.get('/', validate({ query: equipmentListQuerySchema }), controller.list);
  router.post('/', validate({ body: equipmentCreateSchema }), controller.create);
  router.get(
    '/:id/requests',
    validate({ params: idParamsSchema, query: requestListQuerySchema }),
    requestController.listByEquipment,
  );
  router.get('/:id/weather', validate({ params: idParamsSchema }), weatherController.getForecast);
  router.get('/:id', validate({ params: idParamsSchema }), controller.getById);
  router.patch('/:id', validate({ params: idParamsSchema, body: equipmentUpdateSchema }), controller.update);
  router.delete('/:id', validate({ params: idParamsSchema }), controller.remove);

  return router;
}