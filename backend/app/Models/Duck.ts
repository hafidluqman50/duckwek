import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'
import { sequelize } from '@config/database'

export type Template = 'balanced' | 'sprint' | 'tank'
export interface Cosmetics {
  hat: boolean
  shades: boolean
  scarf: boolean
}
export type DuckStatus = 'egg' | 'hatching' | 'hatched' | 'failed'

/**
 * The duck IS the player profile (one per wallet). It is an "egg" off-chain until the wallet
 * finishes its first paid race, then the operator hatches it into a DuckNFT.
 */
class Duck extends Model<InferAttributes<Duck>, InferCreationAttributes<Duck>> {
  declare id: CreationOptional<number>
  declare address: string
  declare name: string
  declare template: Template
  declare body_color: string
  declare bill_color: string
  declare cosmetics: Cosmetics
  declare equipped_part_type_id: number | null
  declare races: CreationOptional<number>
  declare titles: CreationOptional<number>
  declare best_rank: number | null
  declare status: CreationOptional<DuckStatus>
  declare token_id: string | null
  declare tx_hash: string | null
  declare created_at: CreationOptional<Date>
  declare updated_at: CreationOptional<Date>
}

Duck.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    address: { type: DataTypes.STRING(42), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(14), allowNull: false },
    template: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'sprint' },
    body_color: { type: DataTypes.STRING(7), allowNull: false, defaultValue: '#FFC93C' },
    bill_color: { type: DataTypes.STRING(7), allowNull: false, defaultValue: '#FF9F1C' },
    cosmetics: { type: DataTypes.JSONB, allowNull: false, defaultValue: { hat: false, shades: false, scarf: false } },
    equipped_part_type_id: { type: DataTypes.INTEGER, allowNull: true },
    races: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    titles: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    best_rank: { type: DataTypes.INTEGER, allowNull: true },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'egg' },
    token_id: { type: DataTypes.STRING(78), allowNull: true },
    tx_hash: { type: DataTypes.STRING(66), allowNull: true },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  { sequelize, tableName: 'ducks' },
)

export { Duck }
