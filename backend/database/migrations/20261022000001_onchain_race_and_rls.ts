import { DataTypes } from 'sequelize'
import type { Migration } from '../umzug'

const ts = { created_at: { type: DataTypes.DATE, allowNull: false }, updated_at: { type: DataTypes.DATE, allowNull: false } }

export const up: Migration = async ({ context: q }) => {
  await q.addColumn('rooms', 'chain_room_id', { type: DataTypes.BIGINT, allowNull: true })
  await q.addColumn('room_players', 'join_signature', { type: DataTypes.TEXT, allowNull: true })
  await q.addColumn('room_players', 'joined_on_chain', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false })
  await q.addColumn('races', 'start_tx', { type: DataTypes.STRING(66), allowNull: true })
  await q.createTable('race_ticks', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    room_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'rooms', key: 'id' }, onDelete: 'CASCADE' },
    race_id: { type: DataTypes.BIGINT, allowNull: false },
    seq: { type: DataTypes.INTEGER, allowNull: false },
    blk: { type: DataTypes.BIGINT, allowNull: false },
    block_hash: { type: DataTypes.STRING(66), allowNull: true },
    source: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'monad' },
    positions: { type: DataTypes.TEXT, allowNull: false },
    tx_hash: { type: DataTypes.STRING(66), allowNull: true },
    included_block: { type: DataTypes.BIGINT, allowNull: true },
    status: { type: DataTypes.STRING(32), allowNull: true },
    gas_limit: { type: DataTypes.INTEGER, allowNull: true },
    submit_to_receipt_ms: { type: DataTypes.INTEGER, allowNull: true },
    ...ts,
  })
  await q.addIndex('race_ticks', ['room_id', 'race_id', 'blk'], { unique: true })

  // Supabase exposes the public schema through its REST API. The backend connects as the postgres role (bypasses RLS);
  // with RLS on and no policy, the anon and authenticated roles can read and write nothing.
  const [rows] = (await q.sequelize.query("select tablename from pg_tables where schemaname = current_schema()")) as [{ tablename: string }[], unknown]
  for (const r of rows) await q.sequelize.query(`alter table "${r.tablename}" enable row level security`)
}

export const down: Migration = async ({ context: q }) => {
  await q.dropTable('race_ticks')
  await q.removeColumn('races', 'start_tx')
  await q.removeColumn('room_players', 'joined_on_chain')
  await q.removeColumn('room_players', 'join_signature')
  await q.removeColumn('rooms', 'chain_room_id')
}
