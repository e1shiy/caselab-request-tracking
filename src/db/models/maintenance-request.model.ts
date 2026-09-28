import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

import { REQUEST_PRIORITIES, REQUEST_STATUSES } from '../../domain/request.js';
import type { RequestPriority, RequestStatus } from '../../domain/request.js';

export class MaintenanceRequestModel extends Model<
  InferAttributes<MaintenanceRequestModel>,
  InferCreationAttributes<MaintenanceRequestModel>
> {
  declare id: CreationOptional<string>;
  declare equipmentId: string;
  declare title: string;
  declare description: string;
  declare priority: RequestPriority;
  declare status: CreationOptional<RequestStatus>;
  declare plannedAt: string | null;
  declare author: CreationOptional<string>;
  declare closedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function defineMaintenanceRequestModel(sequelize: Sequelize): void {
  MaintenanceRequestModel.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      equipmentId: { type: DataTypes.UUID, allowNull: false },
      title: { type: DataTypes.TEXT, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false },
      priority: { type: DataTypes.ENUM(...REQUEST_PRIORITIES), allowNull: false },
      status: {
        type: DataTypes.ENUM(...REQUEST_STATUSES),
        allowNull: false,
        defaultValue: 'new',
      },
      plannedAt: { type: DataTypes.DATEONLY, allowNull: true },
      author: { type: DataTypes.TEXT, allowNull: false },
      closedAt: { type: DataTypes.DATE, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    },
    {
      sequelize,
      modelName: 'maintenanceRequest',
      tableName: 'maintenance_requests',
      timestamps: true,
    },
  );
}
