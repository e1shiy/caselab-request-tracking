import { Router } from 'express';

import type { SiteController } from '../controllers/site-controller.js';
import { validate } from '../middleware/validate.js';
import { idParamsSchema } from '../schemas/common.js';

export function createSitesRouter(controller: SiteController): Router {
  const router = Router();

  router.get('/:id/summary', validate({ params: idParamsSchema }), controller.summary);

  return router;
}
