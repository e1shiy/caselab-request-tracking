import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';

export class TechnicianModel extends Model<
  InferAttributes<TechnicianModel>,
  InferCreationAttributes<TechnicianModel>
> {
  declare id: CreationOptional<string>;
  declare fullName: string;
  declare specialization: string;
  declare personnelNumber: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function defineTechnicianModel(sequelize: Sequelize): void {
  TechnicianModel.init(
    {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      fullName: { type: DataTypes.TEXT, allowNull: false },
      specialization: { type: DataTypes.TEXT, allowNull: false },
      personnelNumber: { type: DataTypes.TEXT, allowNull: false, unique: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    },
    { sequelize, modelName: 'technician', tableName: 'technicians', timestamps: true },
  );
}
