import { DataTypes } from 'sequelize'
import type { Migration } from '../umzug'

const ts = { created_at: { type: DataTypes.DATE, allowNull: false }, updated_at: { type: DataTypes.DATE, allowNull: false } }

export const up: Migration = async ({ context: q }) => {
  await q.createTable('payments', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    kind: { type: DataTypes.STRING(16), allowNull: false },
    payer: { type: DataTypes.STRING(42), allowNull: false },
    amount: { type: DataTypes.BIGINT, allowNull: false },
    ref: { type: DataTypes.STRING(78), allowNull: false, defaultValue: '0' },
    room_code: { type: DataTypes.STRING(12), allowNull: true },
    nonce: { type: DataTypes.STRING(78), allowNull: false },
    deadline: { type: DataTypes.BIGINT, allowNull: false },
    tx_hash: { type: DataTypes.STRING(66), allowNull: true },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'prepared' },
    error: { type: DataTypes.TEXT, allowNull: true },
    meta: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    ...ts,
  })
  await q.addIndex('payments', ['payer', 'nonce'], { unique: true })
  await q.createTable('part_licenses', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    address: { type: DataTypes.STRING(42), allowNull: false },
    type_id: { type: DataTypes.INTEGER, allowNull: false },
    token_id: { type: DataTypes.STRING(78), allowNull: false },
    tx_hash: { type: DataTypes.STRING(66), allowNull: false },
    ...ts,
  })
  await q.addIndex('part_licenses', ['address'])
  await q.createTable('races', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    room_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'rooms', key: 'id' }, onDelete: 'CASCADE' },
    race_id: { type: DataTypes.BIGINT, allowNull: false },
    seed: { type: DataTypes.BIGINT, allowNull: false },
    start_block: { type: DataTypes.BIGINT, allowNull: false },
    end_block: { type: DataTypes.BIGINT, allowNull: true },
    ranking: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    podium: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    results_root: { type: DataTypes.STRING(66), allowNull: true },
    settle_tx: { type: DataTypes.STRING(66), allowNull: true },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'running' },
    ...ts,
  })
  await q.createTable('ducks', {
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
    ...ts,
  })
  await q.createTable('titles', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    address: { type: DataTypes.STRING(42), allowNull: false },
    room_code: { type: DataTypes.STRING(12), allowNull: false },
    race_id: { type: DataTypes.BIGINT, allowNull: false },
    rank: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(32), allowNull: false },
    tx_hash: { type: DataTypes.STRING(66), allowNull: true },
    ...ts,
  })
  await q.addIndex('titles', ['address'])
}

export const down: Migration = async ({ context: q }) => {
  await q.dropTable('titles')
  await q.dropTable('ducks')
  await q.dropTable('races')
  await q.dropTable('part_licenses')
  await q.dropTable('payments')
}
