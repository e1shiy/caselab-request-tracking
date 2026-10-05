import { Router } from 'express';

import { EquipmentController } from '../controllers/equipment-controller.js';
import type { RequestController } from '../controllers/request-controller.js';
import type { WeatherController } from '../controllers/weather-controller.js';
import { requireRole } from '../middleware/require-role.js';
import { validate } from '../middleware/validate.js';
import type { Storage } from '../repositories/index.js';
import { PAGINATION_FIELDS, idParamsSchema } from '../schemas/common.js';
import {
  equipmentCreateSchema,
  equipmentListQuerySchema,
  equipmentUpdateSchema,
} from '../schemas/equipment.js';
import { requestListQuerySchema } from '../schemas/request.js';
import { EQUIPMENT_MANAGE_ROLES } from '../services/access-control.js';
import { EquipmentService } from '../services/equipment-service.js';

export function createEquipmentRouter(
  storage: Storage,
  requestController: RequestController,
  weatherController: WeatherController,
): Router {
  const service = new EquipmentService(storage.equipment, storage.requests);
  const controller = new EquipmentController(service);

  const router = Router();

  router.get(
    '/',
    validate({ query: equipmentListQuerySchema }, { rangeFields: PAGINATION_FIELDS }),
    controller.list,
  );
  router.post('/', requireRole(...EQUIPMENT_MANAGE_ROLES), validate({ body: equipmentCreateSchema }), controller.create);
  router.get(
    '/:id/requests',
    validate(
      { params: idParamsSchema, query: requestListQuerySchema },
      { rangeFields: PAGINATION_FIELDS },
    ),
    requestController.listByEquipment,
  );
  router.get('/:id/weather', validate({ params: idParamsSchema }), weatherController.getForecast);
  router.get('/:id', validate({ params: idParamsSchema }), controller.getById);
  router.patch(
    '/:id',
    requireRole(...EQUIPMENT_MANAGE_ROLES),
    validate({ params: idParamsSchema, body: equipmentUpdateSchema }),
    controller.update,
  );
  router.delete('/:id', requireRole(...EQUIPMENT_MANAGE_ROLES), validate({ params: idParamsSchema }), controller.remove);

  return router;
}