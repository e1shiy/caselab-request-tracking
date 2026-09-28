import { Router } from 'express';

import type { ReportController } from '../controllers/report-controller.js';
import { validate } from '../middleware/validate.js';
import { equipmentLoadQuerySchema } from '../schemas/report.js';

const LIMIT_FIELDS = ['limit'] as const;

export function createReportsRouter(controller: ReportController): Router {
  const router = Router();

  router.get(
    '/equipment-load',
    validate({ query: equipmentLoadQuerySchema }, { rangeFields: LIMIT_FIELDS }),
    controller.equipmentLoad,
  );

  return router;
}
