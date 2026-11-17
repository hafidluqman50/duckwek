import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'
import { sequelize } from '@config/database'

export type TrackStatus = 'active' | 'coming_soon'
export interface TrackProfile {
  speed: number
  weight: number
  boost: number
  lapTicks: number
}

class Track extends Model<InferAttributes<Track>, InferCreationAttributes<Track>> {
  declare id: CreationOptional<number>
  declare token_id: number | null
  declare slug: string
  declare name: string
  declare description: string
  declare creator: string
  declare platform: boolean
  declare rent_price: string
  declare laps: number
  declare turns: number
  declare length_m: number
  declare closed: boolean
  declare path: number[][]
  declare sectors: number[]
  declare profile: TrackProfile
  declare segments: string
  declare layout_version: number
  declare layout_hash: string | null
  declare holder: string | null
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
    segments: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    layout_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    layout_hash: { type: DataTypes.STRING(66), allowNull: true },
    holder: { type: DataTypes.STRING(42), allowNull: true },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'active' },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  { sequelize, tableName: 'tracks' },
)

export { Track }
