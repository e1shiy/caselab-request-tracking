import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

import { USER_ROLES, type UserRole } from '../../domain/user.js';

export class UserModel extends Model<
  InferAttributes<UserModel>,
  InferCreationAttributes<UserModel>
> {
  declare id: CreationOptional<string>;
  declare email: string;
  declare passwordHash: string;
  declare fullName: string;
  declare role: CreationOptional<UserRole>;
  declare technicianId: CreationOptional<string | null>;
  declare tokenVersion: CreationOptional<number>;
  declare isActive: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function defineUserModel(sequelize: Sequelize): void {
  UserModel.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      email: { type: DataTypes.TEXT, allowNull: false, unique: true },
      passwordHash: { type: DataTypes.TEXT, allowNull: false },
      fullName: { type: DataTypes.TEXT, allowNull: false },
      role: { type: DataTypes.ENUM(...USER_ROLES), allowNull: false, defaultValue: 'viewer' },
      technicianId: { type: DataTypes.UUID, allowNull: true },
      tokenVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    },
    { sequelize, modelName: 'user', tableName: 'users', timestamps: true },
  );
}