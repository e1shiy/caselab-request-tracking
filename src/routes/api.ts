import { Router } from 'express';

import { ReportController } from '../controllers/report-controller.js';
import { RequestController } from '../controllers/request-controller.js';
import { SiteController } from '../controllers/site-controller.js';
import { WeatherController } from '../controllers/weather-controller.js';
import type { Storage } from '../repositories/index.js';
import { ReportService } from '../services/report-service.js';
import { RequestService } from '../services/request-service.js';
import { SiteService } from '../services/site-service.js';
import { WeatherService } from '../services/weather-service.js';
import { createEquipmentRouter } from './equipment.js';
import { createReportsRouter } from './reports.js';
import { createRequestsRouter } from './requests.js';
import { createSitesRouter } from './sites.js';

export function createApiRouter(storage: Storage): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const requestService = new RequestService(storage.requests, storage.equipment, storage.transaction);
  const requestController = new RequestController(requestService);
  const weatherController = new WeatherController(new WeatherService(storage.equipment));
  const siteController = new SiteController(new SiteService(storage.sites));
  const reportController = new ReportController(new ReportService(storage.reports));

  router.use('/equipment', createEquipmentRouter(storage, requestController, weatherController));
  router.use('/requests', createRequestsRouter(requestController));
  router.use('/reports', createReportsRouter(reportController));
  router.use('/sites', createSitesRouter(siteController));

  return router;
}