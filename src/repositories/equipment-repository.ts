import type { Equipment, EquipmentCard, EquipmentStatus, EquipmentType } from '../domain/equipment.js';
import type { EquipmentCreateInput, EquipmentUpdateInput } from '../schemas/equipment.js';
import type { ListParams, Page, Transaction } from './common.js';

export interface EquipmentListParams extends ListParams {
  status?: EquipmentStatus;
  type?: EquipmentType;
  installedFrom?: string;
  installedTo?: string;
  siteId?: string;
}

export interface EquipmentRepository {
  list(params: EquipmentListParams, transaction?: Transaction): Promise<Page<Equipment>>;
  findById(id: string, transaction?: Transaction): Promise<Equipment | null>;
  findCardById(id: string, transaction?: Transaction): Promise<EquipmentCard | null>;
  create(input: EquipmentCreateInput, siteId: string | null, transaction?: Transaction): Promise<Equipment>;
  update(id: string, input: EquipmentUpdateInput, siteId: string | null | undefined, transaction?: Transaction): Promise<Equipment | null>;
  remove(id: string, transaction?: Transaction): Promise<boolean>;
  existsBySerialNumber(serialNumber: string, excludeId?: string, transaction?: Transaction): Promise<boolean>;
}
