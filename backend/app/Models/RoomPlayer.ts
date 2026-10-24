import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, ForeignKey } from 'sequelize'
import { sequelize } from '@config/database'
import { Room } from './Room'

export interface Cosmetics {
  hat: boolean
  shades: boolean
  scarf: boolean
}
export type Template = 'balanced' | 'sprint' | 'tank'

class RoomPlayer extends Model<InferAttributes<RoomPlayer>, InferCreationAttributes<RoomPlayer>> {
  declare id: CreationOptional<number>
  declare room_id: ForeignKey<Room['id']>
  declare address: string
  declare duck_name: string
  declare template: Template
  declare body_color: string
  declare bill_color: string
  declare part_type_id: number | null
  declare cosmetics: Cosmetics
  declare locked: boolean
  declare join_tx: string | null
  declare joined_on_chain: boolean
  declare created_at: CreationOptional<Date>
  declare updated_at: CreationOptional<Date>
}

RoomPlayer.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    address: { type: DataTypes.STRING(42), allowNull: false },
    duck_name: { type: DataTypes.STRING(14), allowNull: false },
    template: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'sprint' },
    body_color: { type: DataTypes.STRING(7), allowNull: false, defaultValue: '#FFC93C' },
    bill_color: { type: DataTypes.STRING(7), allowNull: false, defaultValue: '#FF9F1C' },
    part_type_id: { type: DataTypes.INTEGER, allowNull: true },
    cosmetics: { type: DataTypes.JSONB, allowNull: false, defaultValue: { hat: false, shades: false, scarf: false } },
    locked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    join_tx: { type: DataTypes.STRING(66), allowNull: true },
    joined_on_chain: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  { sequelize, tableName: 'room_players', indexes: [{ unique: true, fields: ['room_id', 'address'] }] },
)

export { RoomPlayer }
