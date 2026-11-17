import { DataTypes } from 'sequelize'
import type { Migration } from '../umzug'
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn('part_types', 'rarity')
  await queryInterface.addColumn('part_types', 'color', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0xffffff })
  await queryInterface.addColumn('part_types', 'stats', { type: DataTypes.JSONB, allowNull: false, defaultValue: {} })

  await queryInterface.addColumn('tracks', 'segments', { type: DataTypes.TEXT, allowNull: false, defaultValue: '' })
  await queryInterface.addColumn('tracks', 'layout_version', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 })
  await queryInterface.addColumn('tracks', 'layout_hash', { type: DataTypes.STRING(66), allowNull: true })
  await queryInterface.addColumn('tracks', 'holder', { type: DataTypes.STRING(42), allowNull: true })

  await queryInterface.removeColumn('ducks', 'token_id')
  await queryInterface.removeColumn('ducks', 'tx_hash')
  await queryInterface.sequelize.query("UPDATE ducks SET status = 'egg' WHERE status IN ('hatching', 'failed')")

  await queryInterface.addColumn('races', 'engine_version', { type: DataTypes.STRING(66), allowNull: true })
  await queryInterface.addColumn('races', 'participants_root', { type: DataTypes.STRING(66), allowNull: true })
  await queryInterface.addColumn('races', 'layout_version', { type: DataTypes.INTEGER, allowNull: true })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn('races', 'layout_version')
  await queryInterface.removeColumn('races', 'participants_root')
  await queryInterface.removeColumn('races', 'engine_version')
  await queryInterface.addColumn('ducks', 'tx_hash', { type: DataTypes.STRING(66), allowNull: true })
  await queryInterface.addColumn('ducks', 'token_id', { type: DataTypes.STRING(78), allowNull: true })
  await queryInterface.removeColumn('tracks', 'holder')
  await queryInterface.removeColumn('tracks', 'layout_hash')
  await queryInterface.removeColumn('tracks', 'layout_version')
  await queryInterface.removeColumn('tracks', 'segments')
  await queryInterface.removeColumn('part_types', 'stats')
  await queryInterface.removeColumn('part_types', 'color')
  await queryInterface.addColumn('part_types', 'rarity', { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'COMMON' })
}
