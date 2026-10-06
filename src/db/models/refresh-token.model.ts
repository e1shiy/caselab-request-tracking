import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

export class RefreshTokenModel extends Model<
  InferAttributes<RefreshTokenModel>,
  InferCreationAttributes<RefreshTokenModel>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare tokenVersion: number;
  declare expiresAt: Date;
  declare createdAt: CreationOptional<Date>;
}

export function defineRefreshTokenModel(sequelize: Sequelize): void {
  RefreshTokenModel.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      userId: { type: DataTypes.UUID, allowNull: false },
      tokenVersion: { type: DataTypes.INTEGER, allowNull: false },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
    },
    { sequelize, modelName: 'refreshToken', tableName: 'refresh_tokens', timestamps: true, updatedAt: false },
  );
}