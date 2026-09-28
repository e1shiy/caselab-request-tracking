import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

import { EQUIPMENT_STATUSES, EQUIPMENT_TYPES } from '../../domain/equipment.js';
import type { EquipmentStatus, EquipmentType } from '../../domain/equipment.js';

export class EquipmentModel extends Model<
  InferAttributes<EquipmentModel>,
  InferCreationAttributes<EquipmentModel>
> {
  declare id: CreationOptional<string>;
  declare siteId: string | null;
  declare name: string;
  declare type: EquipmentType;
  declare serialNumber: string;
  declare latitude: number;
  declare longitude: number;
  declare status: CreationOptional<EquipmentStatus>;
  declare installedAt: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function defineEquipmentModel(sequelize: Sequelize): void {
  EquipmentModel.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      siteId: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.TEXT, allowNull: false },
      type: { type: DataTypes.ENUM(...EQUIPMENT_TYPES), allowNull: false },
      serialNumber: { type: DataTypes.TEXT, allowNull: false, unique: true },
      latitude: { type: DataTypes.DOUBLE, allowNull: false },
      longitude: { type: DataTypes.DOUBLE, allowNull: false },
      status: { type: DataTypes.ENUM(...EQUIPMENT_STATUSES), allowNull: false, defaultValue: 'operational' },
      installedAt: { type: DataTypes.DATEONLY, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    },
    { sequelize, modelName: 'equipment', tableName: 'equipment', timestamps: true },
  );
}
