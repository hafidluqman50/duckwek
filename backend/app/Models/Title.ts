import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'
import { sequelize } from '@config/database'

/** Mirror of a soulbound Badge awarded on-chain by Settlement (podium only, never bought). */
class Title extends Model<InferAttributes<Title>, InferCreationAttributes<Title>> {
  declare id: CreationOptional<number>
  declare address: string
  declare room_code: string
  declare race_id: string
  declare rank: number
  declare title: string
  declare tx_hash: string | null
  declare created_at: CreationOptional<Date>
  declare updated_at: CreationOptional<Date>
}

Title.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    address: { type: DataTypes.STRING(42), allowNull: false },
    room_code: { type: DataTypes.STRING(12), allowNull: false },
    race_id: { type: DataTypes.BIGINT, allowNull: false },
    rank: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(32), allowNull: false },
    tx_hash: { type: DataTypes.STRING(66), allowNull: true },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  { sequelize, tableName: 'titles' },
)

export { Title }
