import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

export class EquipmentPassportModel extends Model<
  InferAttributes<EquipmentPassportModel>,
  InferCreationAttributes<EquipmentPassportModel>
> {
  declare equipmentId: string;
  declare manufacturer: string;
  declare model: string;
  declare ratedPowerKw: number;
  declare lastVerifiedAt: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function defineEquipmentPassportModel(sequelize: Sequelize): void {
  EquipmentPassportModel.init(
    {
      equipmentId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
      },
      manufacturer: { type: DataTypes.TEXT, allowNull: false },
      model: { type: DataTypes.TEXT, allowNull: false },
      ratedPowerKw: { type: DataTypes.DOUBLE, allowNull: false },
      lastVerifiedAt: { type: DataTypes.DATEONLY, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    },
    {
      sequelize,
      modelName: 'equipmentPassport',
      tableName: 'equipment_passports',
      timestamps: true,
    },
  );
}
