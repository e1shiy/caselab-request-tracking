import { Router } from 'express';

import type { RequestController } from '../controllers/request-controller.js';
import { validate } from '../middleware/validate.js';
import { PAGINATION_FIELDS, idParamsSchema } from '../schemas/common.js';
import {
  requestAssigneeParamsSchema,
  requestAssigneesSchema,
  requestCreateSchema,
  requestListQuerySchema,
  requestStatusSchema,
  requestUpdateSchema,
} from '../schemas/request.js';

export function createRequestsRouter(controller: RequestController): Router {
  const router = Router();

  router.get(
    '/',
    validate({ query: requestListQuerySchema }, { rangeFields: PAGINATION_FIELDS }),
    controller.list,
  );
  router.post('/', validate({ body: requestCreateSchema }), controller.create);
  router.get('/:id', validate({ params: idParamsSchema }), controller.getById);
  router.get('/:id/history', validate({ params: idParamsSchema }), controller.history);
  router.patch('/:id', validate({ params: idParamsSchema, body: requestUpdateSchema }), controller.update);
  router.patch('/:id/status', validate({ params: idParamsSchema, body: requestStatusSchema }), controller.changeStatus);
  router.post(
    '/:id/assignees',
    validate({ params: idParamsSchema, body: requestAssigneesSchema }),
    controller.assignCrew,
  );
  router.delete(
    '/:id/assignees/:technicianId',
    validate({ params: requestAssigneeParamsSchema }),
    controller.removeAssignee,
  );
  router.delete('/:id', validate({ params: idParamsSchema }), controller.remove);

  return router;
}