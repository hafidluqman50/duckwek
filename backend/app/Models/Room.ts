import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute, ForeignKey } from 'sequelize'
import { sequelize } from '@config/database'
import { Track } from './Track'

export type RoomStatus = 'pending' | 'lobby' | 'grid' | 'race' | 'results' | 'closed'

class Room extends Model<InferAttributes<Room>, InferCreationAttributes<Room>> {
  declare id: CreationOptional<number>
  declare code: string
  declare room_key: string
  declare name: string
  declare host: string
  declare track_id: ForeignKey<Track['id']>
  declare max_ducks: number
  declare fill_bots: boolean
  declare status: RoomStatus
  declare create_tx: string | null
  declare chain_room_id: string | null
  declare created_at: CreationOptional<Date>
  declare updated_at: CreationOptional<Date>
  declare track?: NonAttribute<Track>
}

Room.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(12), allowNull: false, unique: true },
    room_key: { type: DataTypes.STRING(66), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(64), allowNull: false },
    host: { type: DataTypes.STRING(42), allowNull: false },
    max_ducks: { type: DataTypes.INTEGER, allowNull: false },
    fill_bots: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending' },
    create_tx: { type: DataTypes.STRING(66), allowNull: true },
    chain_room_id: { type: DataTypes.BIGINT, allowNull: true },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  { sequelize, tableName: 'rooms' },
)

export { Room }
