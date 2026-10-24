import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey } from 'sequelize'
import { sequelize } from '@config/database'
import { Room } from './Room'

export interface RankRow {
  rank: number
  name: string
  address: string | null
  human: boolean
  progress: number
}

class Race extends Model<InferAttributes<Race>, InferCreationAttributes<Race>> {
  declare id: CreationOptional<number>
  declare room_id: ForeignKey<Room['id']>
  declare race_id: string
  declare seed: string
  declare start_block: string
  declare end_block: string | null
  declare ranking: RankRow[]
  declare podium: string[]
  declare results_root: string | null
  declare cheers: CreationOptional<Record<string, Record<string, number>>>
  declare cheers_root: string | null
  declare settle_tx: string | null
  declare start_tx: string | null
  declare status: 'running' | 'settling' | 'settled' | 'failed'
  declare created_at: CreationOptional<Date>
  declare updated_at: CreationOptional<Date>
}

Race.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    race_id: { type: DataTypes.BIGINT, allowNull: false },
    seed: { type: DataTypes.STRING(66), allowNull: false },
    start_block: { type: DataTypes.BIGINT, allowNull: false },
    end_block: { type: DataTypes.BIGINT, allowNull: true },
    ranking: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    podium: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    results_root: { type: DataTypes.STRING(66), allowNull: true },
    cheers: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    cheers_root: { type: DataTypes.STRING(66), allowNull: true },
    settle_tx: { type: DataTypes.STRING(66), allowNull: true },
    start_tx: { type: DataTypes.STRING(66), allowNull: true },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'running' },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  { sequelize, tableName: 'races' },
)

export { Race }
