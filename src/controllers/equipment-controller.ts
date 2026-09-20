import type { Response } from 'express';

import { asyncHandler } from '../lib/async-handler.js';
import type { EquipmentService } from '../services/equipment-service.js';
import type { IdParams } from '../schemas/equipment.js';
import type { EquipmentCreateInput, EquipmentListQuery, EquipmentUpdateInput } from '../schemas/equipment.js';

export class EquipmentController {
  constructor(private readonly service: EquipmentService) {}

  list = asyncHandler(async (req, res) => {
    const query = req.valid.query as EquipmentListQuery;
    res.json(await this.service.list(query));
  });

  create = asyncHandler(async (req, res) => {
    const body = req.valid.body as EquipmentCreateInput;
    const equipment = await this.service.create(body);
    res.status(201).location(`/api/equipment/${equipment.id}`).json(equipment);
  });

  getById = asyncHandler(async (req, res) => {
    const { id } = req.valid.params as IdParams;
    res.json(await this.service.getById(id));
  });

  update = asyncHandler(async (req, res) => {
    const { id } = req.valid.params as IdParams;
    const body = req.valid.body as EquipmentUpdateInput;
    res.json(await this.service.update(id, body));
  });

  remove = asyncHandler(async (req, res: Response) => {
    const { id } = req.valid.params as IdParams;
    await this.service.delete(id);
    res.status(204).send();
  });
}