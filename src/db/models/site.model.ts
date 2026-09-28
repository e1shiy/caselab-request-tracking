import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

export class SiteModel extends Model<InferAttributes<SiteModel>, InferCreationAttributes<SiteModel>> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare code: string;
  declare region: string;
  declare latitude: number;
  declare longitude: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function defineSiteModel(sequelize: Sequelize): void {
  SiteModel.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      name: { type: DataTypes.TEXT, allowNull: false },
      code: { type: DataTypes.TEXT, allowNull: false, unique: true },
      region: { type: DataTypes.TEXT, allowNull: false },
      latitude: { type: DataTypes.DOUBLE, allowNull: false },
      longitude: { type: DataTypes.DOUBLE, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    },
    { sequelize, modelName: 'site', tableName: 'sites', timestamps: true },
  );
}
