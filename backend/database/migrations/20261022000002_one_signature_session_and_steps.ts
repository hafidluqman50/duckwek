import { DataTypes } from 'sequelize'
import type { Migration } from '../umzug'

export const up: Migration = async ({ context: q }) => {
  // The session: the permit signed once at connect (login proof and spending authorisation, plan §3.2).
  await q.addColumn('auth_nonces', 'permit_nonce', { type: DataTypes.STRING(78), allowNull: true })
  await q.addColumn('auth_nonces', 'deadline', { type: DataTypes.BIGINT, allowNull: true })
  await q.addColumn('auth_nonces', 'signature', { type: DataTypes.TEXT, allowNull: true })
  await q.addColumn('auth_nonces', 'permit_used', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false })
  await q.addColumn('auth_nonces', 'spent', { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 })
  // The welcome USDC is minted inside the first paid order of a wallet.
  await q.addColumn('players', 'first_spend_at', { type: DataTypes.DATE, allowNull: true })

  // Race: the seed is the contract's bytes32; ticks are numbered by step and several can land in one block.
  await q.changeColumn('races', 'seed', { type: DataTypes.STRING(66), allowNull: false })
  await q.removeIndex('race_ticks', ['room_id', 'race_id', 'blk'])
  await q.addColumn('race_ticks', 'step', { type: DataTypes.INTEGER, allowNull: true })
  await q.sequelize.query('update race_ticks set step = seq + 1 where step is null')
  await q.changeColumn('race_ticks', 'step', { type: DataTypes.INTEGER, allowNull: false })
  await q.addIndex('race_ticks', ['room_id', 'race_id', 'step'], { unique: true })
  await q.removeColumn('race_ticks', 'block_hash')
  await q.removeColumn('race_ticks', 'source')
  await q.removeColumn('room_players', 'join_signature')
}

export const down: Migration = async ({ context: q }) => {
  await q.addColumn('room_players', 'join_signature', { type: DataTypes.TEXT, allowNull: true })
  await q.addColumn('race_ticks', 'source', { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'monad' })
  await q.addColumn('race_ticks', 'block_hash', { type: DataTypes.STRING(66), allowNull: true })
  await q.removeIndex('race_ticks', ['room_id', 'race_id', 'step'])
  await q.removeColumn('race_ticks', 'step')
  await q.addIndex('race_ticks', ['room_id', 'race_id', 'blk'], { unique: true })
  await q.sequelize.query("alter table races alter column seed type bigint using 0")
  await q.removeColumn('players', 'first_spend_at')
  for (const c of ['spent', 'permit_used', 'signature', 'deadline', 'permit_nonce']) await q.removeColumn('auth_nonces', c)
}
