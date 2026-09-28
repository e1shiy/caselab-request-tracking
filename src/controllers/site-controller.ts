import { asyncHandler } from '../lib/async-handler.js';
import type { IdParams } from '../schemas/common.js';
import type { SiteService } from '../services/site-service.js';

export class SiteController {
  constructor(private readonly service: SiteService) {}

  summary = asyncHandler(async (req, res) => {
    const { id } = req.valid.params as IdParams;
    res.json(await this.service.summary(id));
  });
}
