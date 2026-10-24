import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey } from 'sequelize'
import { sequelize } from '@config/database'
import { Room } from './Room'

/** One row per race block: what the engine computed, and what happened to the on-chain tick transaction. */
class RaceTick extends Model<InferAttributes<RaceTick>, InferCreationAttributes<RaceTick>> {
  declare id: CreationOptional<number>
  declare room_id: ForeignKey<Room['id']>
  declare race_id: string
  declare seq: number
  declare blk: string
  declare step: number
  declare positions: string
  declare tx_hash: string | null
  declare included_block: string | null
  declare status: string | null
  declare gas_limit: number | null
  declare submit_to_receipt_ms: number | null
  declare created_at: CreationOptional<Date>
  declare updated_at: CreationOptional<Date>
}

RaceTick.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    race_id: { type: DataTypes.BIGINT, allowNull: false },
    seq: { type: DataTypes.INTEGER, allowNull: false },
    blk: { type: DataTypes.BIGINT, allowNull: false },
    step: { type: DataTypes.INTEGER, allowNull: false },
    positions: { type: DataTypes.TEXT, allowNull: false },
    tx_hash: { type: DataTypes.STRING(66), allowNull: true },
    included_block: { type: DataTypes.BIGINT, allowNull: true },
    status: { type: DataTypes.STRING(32), allowNull: true },
    gas_limit: { type: DataTypes.INTEGER, allowNull: true },
    submit_to_receipt_ms: { type: DataTypes.INTEGER, allowNull: true },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  { sequelize, tableName: 'race_ticks', indexes: [{ unique: true, fields: ['room_id', 'race_id', 'step'] }] },
)

export { RaceTick }
