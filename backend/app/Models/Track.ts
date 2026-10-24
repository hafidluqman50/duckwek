import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'
import { sequelize } from '@config/database'

export type TrackStatus = 'active' | 'coming_soon'
export interface TrackProfile {
  speed: number // multiplier on speed stat (long straights > 1)
  weight: number // multiplier on weight drag (twisty tracks < 1: weight = grip)
  boost: number
  lapTicks: number // blocks per lap
}

class Track extends Model<InferAttributes<Track>, InferCreationAttributes<Track>> {
  declare id: CreationOptional<number>
  declare token_id: number | null
  declare slug: string
  declare name: string
  declare description: string
  declare creator: string
  declare platform: boolean
  declare rent_price: string // USDC base units (6 decimals) as string
  declare laps: number
  declare turns: number
  declare length_m: number
  declare closed: boolean
  declare path: number[][]
  declare sectors: number[]
  declare profile: TrackProfile
  declare status: TrackStatus
  declare created_at: CreationOptional<Date>
  declare updated_at: CreationOptional<Date>
}

Track.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    token_id: { type: DataTypes.INTEGER, allowNull: true },
    slug: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(64), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    creator: { type: DataTypes.STRING(42), allowNull: false },
    platform: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    rent_price: { type: DataTypes.BIGINT, allowNull: false },
    laps: { type: DataTypes.INTEGER, allowNull: false },
    turns: { type: DataTypes.INTEGER, allowNull: false },
    length_m: { type: DataTypes.INTEGER, allowNull: false },
    closed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    path: { type: DataTypes.JSONB, allowNull: false },
    sectors: { type: DataTypes.JSONB, allowNull: false },
    profile: { type: DataTypes.JSONB, allowNull: false },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'active' },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  { sequelize, tableName: 'tracks' },
)

export { Track }
