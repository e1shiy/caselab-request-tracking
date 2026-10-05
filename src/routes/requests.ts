import { Router } from 'express';

import type { RequestController } from '../controllers/request-controller.js';
import { requireRole } from '../middleware/require-role.js';
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
import { REQUEST_WRITE_ROLES } from '../services/access-control.js';

export function createRequestsRouter(controller: RequestController): Router {
  const router = Router();

  router.get(
    '/',
    validate({ query: requestListQuerySchema }, { rangeFields: PAGINATION_FIELDS }),
    controller.list,
  );
  router.post(
    '/',
    requireRole(...REQUEST_WRITE_ROLES),
    validate({ body: requestCreateSchema }),
    controller.create,
  );
  router.get('/:id', validate({ params: idParamsSchema }), controller.getById);
  router.get('/:id/history', validate({ params: idParamsSchema }), controller.history);
  router.patch(
    '/:id',
    requireRole(...REQUEST_WRITE_ROLES),
    validate({ params: idParamsSchema, body: requestUpdateSchema }),
    controller.update,
  );
  router.patch(
    '/:id/status',
    requireRole(...REQUEST_WRITE_ROLES),
    validate({ params: idParamsSchema, body: requestStatusSchema }),
    controller.changeStatus,
  );
  router.post(
    '/:id/assignees',
    requireRole(...REQUEST_WRITE_ROLES),
    validate({ params: idParamsSchema, body: requestAssigneesSchema }),
    controller.assignCrew,
  );
  router.delete(
    '/:id/assignees/:technicianId',
    requireRole(...REQUEST_WRITE_ROLES),
    validate({ params: requestAssigneeParamsSchema }),
    controller.removeAssignee,
  );
  router.delete('/:id', requireRole('admin'), validate({ params: idParamsSchema }), controller.remove);

  return router;
}