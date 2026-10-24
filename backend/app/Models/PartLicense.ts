import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'
import { sequelize } from '@config/database'

class PartLicense extends Model<InferAttributes<PartLicense>, InferCreationAttributes<PartLicense>> {
  declare id: CreationOptional<number>
  declare address: string
  declare type_id: number
  declare token_id: string
  declare tx_hash: string
  declare created_at: CreationOptional<Date>
  declare updated_at: CreationOptional<Date>
}

PartLicense.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    address: { type: DataTypes.STRING(42), allowNull: false },
    type_id: { type: DataTypes.INTEGER, allowNull: false },
    token_id: { type: DataTypes.STRING(78), allowNull: false },
    tx_hash: { type: DataTypes.STRING(66), allowNull: false },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  { sequelize, tableName: 'part_licenses' },
)

export { PartLicense }
