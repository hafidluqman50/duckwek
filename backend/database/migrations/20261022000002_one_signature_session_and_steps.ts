import { DataTypes } from 'sequelize'
import type { Migration } from '../umzug'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.addColumn('auth_nonces', 'permit_nonce', { type: DataTypes.STRING(78), allowNull: true })
  await queryInterface.addColumn('auth_nonces', 'deadline', { type: DataTypes.BIGINT, allowNull: true })
  await queryInterface.addColumn('auth_nonces', 'signature', { type: DataTypes.TEXT, allowNull: true })
  await queryInterface.addColumn('auth_nonces', 'permit_used', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false })
  await queryInterface.addColumn('auth_nonces', 'spent', { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 })
  await queryInterface.addColumn('players', 'first_spend_at', { type: DataTypes.DATE, allowNull: true })
  await queryInterface.changeColumn('races', 'seed', { type: DataTypes.STRING(66), allowNull: false })
  await queryInterface.removeIndex('race_ticks', ['room_id', 'race_id', 'blk'])
  await queryInterface.addColumn('race_ticks', 'step', { type: DataTypes.INTEGER, allowNull: true })
  await queryInterface.sequelize.query('update race_ticks set step = seq + 1 where step is null')
  await queryInterface.changeColumn('race_ticks', 'step', { type: DataTypes.INTEGER, allowNull: false })
  await queryInterface.addIndex('race_ticks', ['room_id', 'race_id', 'step'], { unique: true })
  await queryInterface.removeColumn('race_ticks', 'block_hash')
  await queryInterface.removeColumn('race_ticks', 'source')
  await queryInterface.removeColumn('room_players', 'join_signature')
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.addColumn('room_players', 'join_signature', { type: DataTypes.TEXT, allowNull: true })
  await queryInterface.addColumn('race_ticks', 'source', { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'monad' })
  await queryInterface.addColumn('race_ticks', 'block_hash', { type: DataTypes.STRING(66), allowNull: true })
  await queryInterface.removeIndex('race_ticks', ['room_id', 'race_id', 'step'])
  await queryInterface.removeColumn('race_ticks', 'step')
  await queryInterface.addIndex('race_ticks', ['room_id', 'race_id', 'blk'], { unique: true })
  await queryInterface.sequelize.query("alter table races alter column seed type bigint using 0")
  await queryInterface.removeColumn('players', 'first_spend_at')

  for (const column of ['spent', 'permit_used', 'signature', 'deadline', 'permit_nonce']) await queryInterface.removeColumn('auth_nonces', column)
}
