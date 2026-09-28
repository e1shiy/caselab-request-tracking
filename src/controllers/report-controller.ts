import { asyncHandler } from '../lib/async-handler.js';
import type { EquipmentLoadQuery } from '../schemas/report.js';
import type { ReportService } from '../services/report-service.js';

export class ReportController {
  constructor(private readonly service: ReportService) {}

  equipmentLoad = asyncHandler(async (req, res) => {
    const query = req.valid.query as EquipmentLoadQuery;
    res.json(await this.service.equipmentLoad(query));
  });
}
