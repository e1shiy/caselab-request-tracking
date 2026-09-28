import { asyncHandler } from '../lib/async-handler.js';
import type {
  IdParams,
  RequestAssigneeParams,
  RequestAssigneesBody,
  RequestCreateInput,
  RequestListQuery,
  RequestStatusBody,
  RequestUpdateInput,
} from '../schemas/request.js';
import type { RequestService } from '../services/request-service.js';

export class RequestController {
  constructor(private readonly service: RequestService) {}

  list = asyncHandler(async (req, res) => {
    const query = req.valid.query as RequestListQuery;
    res.json(await this.service.list(undefined, query));
  });

  listByEquipment = asyncHandler(async (req, res) => {
    const { id } = req.valid.params as IdParams;
    const query = req.valid.query as RequestListQuery;
    res.json(await this.service.list(id, query));
  });

  create = asyncHandler(async (req, res) => {
    const body = req.valid.body as RequestCreateInput;
    const request = await this.service.create(body);
    res.status(201).location(`/api/requests/${request.id}`).json(request);
  });

  getById = asyncHandler(async (req, res) => {
    const { id } = req.valid.params as IdParams;
    res.json(await this.service.getById(id));
  });

  history = asyncHandler(async (req, res) => {
    const { id } = req.valid.params as IdParams;
    res.json(await this.service.history(id));
  });

  update = asyncHandler(async (req, res) => {
    const { id } = req.valid.params as IdParams;
    const body = req.valid.body as RequestUpdateInput;
    res.json(await this.service.update(id, body));
  });

  changeStatus = asyncHandler(async (req, res) => {
    const { id } = req.valid.params as IdParams;
    const body = req.valid.body as RequestStatusBody;
    res.json(await this.service.changeStatus(id, body));
  });

  assignCrew = asyncHandler(async (req, res) => {
    const { id } = req.valid.params as IdParams;
    const body = req.valid.body as RequestAssigneesBody;
    res.status(201).json(await this.service.assignCrew(id, body));
  });

  removeAssignee = asyncHandler(async (req, res) => {
    const { id, technicianId } = req.valid.params as RequestAssigneeParams;
    res.json(await this.service.removeAssignee(id, technicianId));
  });

  remove = asyncHandler(async (req, res) => {
    const { id } = req.valid.params as IdParams;
    await this.service.delete(id);
    res.status(204).send();
  });
}