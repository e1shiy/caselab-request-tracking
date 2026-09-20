import { Router } from 'express';

import type { RequestController } from '../controllers/request-controller.js';
import { validate } from '../middleware/validate.js';
import { idParamsSchema } from '../schemas/common.js';
import {
  requestCreateSchema,
  requestListQuerySchema,
  requestStatusSchema,
  requestUpdateSchema,
} from '../schemas/request.js';

export function createRequestsRouter(controller: RequestController): Router {
  const router = Router();

  router.get('/', validate({ query: requestListQuerySchema }), controller.list);
  router.post('/', validate({ body: requestCreateSchema }), controller.create);
  router.get('/:id', validate({ params: idParamsSchema }), controller.getById);
  router.patch('/:id', validate({ params: idParamsSchema, body: requestUpdateSchema }), controller.update);
  router.patch('/:id/status', validate({ params: idParamsSchema, body: requestStatusSchema }), controller.changeStatus);
  router.delete('/:id', validate({ params: idParamsSchema }), controller.remove);

  return router;
}