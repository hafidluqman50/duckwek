import { DataTypes } from 'sequelize'
import type { Migration } from '../umzug'

const ts = { created_at: { type: DataTypes.DATE, allowNull: false }, updated_at: { type: DataTypes.DATE, allowNull: false } }

export const up: Migration = async ({ context: q }) => {
  await q.createTable('rooms', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(12), allowNull: false, unique: true },
    room_key: { type: DataTypes.STRING(66), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(64), allowNull: false },
    host: { type: DataTypes.STRING(42), allowNull: false },
    track_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'tracks', key: 'id' } },
    max_ducks: { type: DataTypes.INTEGER, allowNull: false },
    fill_bots: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending' },
    create_tx: { type: DataTypes.STRING(66), allowNull: true },
    ...ts,
  })
  await q.createTable('room_players', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    room_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'rooms', key: 'id' }, onDelete: 'CASCADE' },
    address: { type: DataTypes.STRING(42), allowNull: false },
    duck_name: { type: DataTypes.STRING(14), allowNull: false },
    template: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'sprint' },
    body_color: { type: DataTypes.STRING(7), allowNull: false, defaultValue: '#FFC93C' },
    bill_color: { type: DataTypes.STRING(7), allowNull: false, defaultValue: '#FF9F1C' },
    part_type_id: { type: DataTypes.INTEGER, allowNull: true },
    cosmetics: { type: DataTypes.JSONB, allowNull: false, defaultValue: { hat: false, shades: false, scarf: false } },
    locked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    join_tx: { type: DataTypes.STRING(66), allowNull: true },
    ...ts,
  })
  await q.addIndex('room_players', ['room_id', 'address'], { unique: true })
}

export const down: Migration = async ({ context: q }) => {
  await q.dropTable('room_players')
  await q.dropTable('rooms')
}
