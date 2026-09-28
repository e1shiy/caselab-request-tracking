import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

import { REQUEST_STATUSES } from '../../domain/request.js';
import type { RequestStatus } from '../../domain/request.js';

export class RequestStatusHistoryModel extends Model<
  InferAttributes<RequestStatusHistoryModel>,
  InferCreationAttributes<RequestStatusHistoryModel>
> {
  declare id: CreationOptional<string>;
  declare requestId: string;
  declare previousStatus: RequestStatus | null;
  declare newStatus: RequestStatus;
  declare changedBy: string | null;
  declare comment: string | null;
  declare changedAt: CreationOptional<Date>;
}

export function defineRequestStatusHistoryModel(sequelize: Sequelize): void {
  RequestStatusHistoryModel.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      requestId: { type: DataTypes.UUID, allowNull: false },
      previousStatus: { type: DataTypes.ENUM(...REQUEST_STATUSES), allowNull: true },
      newStatus: { type: DataTypes.ENUM(...REQUEST_STATUSES), allowNull: false },
      changedBy: { type: DataTypes.TEXT, allowNull: true },
      comment: { type: DataTypes.TEXT, allowNull: true },
      changedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: 'requestStatusHistory',
      tableName: 'request_status_history',
      timestamps: false,
    },
  );
}
