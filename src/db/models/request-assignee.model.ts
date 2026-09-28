import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

import { ASSIGNEE_ROLES } from '../../domain/technician.js';
import type { AssigneeRole } from '../../domain/technician.js';

export class RequestAssigneeModel extends Model<
  InferAttributes<RequestAssigneeModel>,
  InferCreationAttributes<RequestAssigneeModel>
> {
  declare requestId: string;
  declare technicianId: string;
  declare role: AssigneeRole;
  declare plannedHours: number | null;
  declare assignedAt: CreationOptional<Date>;
}

export function defineRequestAssigneeModel(sequelize: Sequelize): void {
  RequestAssigneeModel.init(
    {
      requestId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      technicianId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      role: { type: DataTypes.ENUM(...ASSIGNEE_ROLES), allowNull: false },
      plannedHours: { type: DataTypes.DOUBLE, allowNull: true },
      assignedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: 'requestAssignee',
      tableName: 'request_assignees',
      timestamps: false,
    },
  );
}
