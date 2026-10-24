import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'
import { sequelize } from '@config/database'

export type PartSlot = 'wings' | 'tail' | 'bill'

class PartType extends Model<InferAttributes<PartType>, InferCreationAttributes<PartType>> {
  declare id: CreationOptional<number>
  declare type_id: number // PartNFT on-chain type id
  declare name: string
  declare rarity: string
  declare slot: PartSlot
  declare speed: number
  declare weight: number
  declare boost: number
  declare fit: Record<string, number>
  declare price: string // USDC base units
  declare creator: string
  declare platform: boolean
  declare status: 'active' | 'coming_soon'
  declare created_at: CreationOptional<Date>
  declare updated_at: CreationOptional<Date>
}

PartType.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    type_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    name: { type: DataTypes.STRING(64), allowNull: false },
    rarity: { type: DataTypes.STRING(16), allowNull: false },
    slot: { type: DataTypes.STRING(16), allowNull: false },
    speed: { type: DataTypes.INTEGER, allowNull: false },
    weight: { type: DataTypes.INTEGER, allowNull: false },
    boost: { type: DataTypes.INTEGER, allowNull: false },
    fit: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    price: { type: DataTypes.BIGINT, allowNull: false },
    creator: { type: DataTypes.STRING(42), allowNull: false },
    platform: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'active' },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  { sequelize, tableName: 'part_types' },
)

export { PartType }
