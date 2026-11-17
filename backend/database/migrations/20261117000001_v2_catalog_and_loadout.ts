import { DataTypes } from 'sequelize'
import type { Migration } from '../umzug'

// Plan 0013 v2: the catalog comes from the chain (no rarity, stats by key, layouts as segments), the loadout is committed at join,
// and the duck is an off-chain profile (no Duck NFT: no token id, no hatch transaction).
export const up: Migration = async ({ context: q }) => {
  await q.removeColumn('part_types', 'rarity')
  await q.addColumn('part_types', 'color', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0xffffff })
  await q.addColumn('part_types', 'stats', { type: DataTypes.JSONB, allowNull: false, defaultValue: {} })

  await q.addColumn('tracks', 'segments', { type: DataTypes.TEXT, allowNull: false, defaultValue: '' })
  await q.addColumn('tracks', 'layout_version', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 })
  await q.addColumn('tracks', 'layout_hash', { type: DataTypes.STRING(66), allowNull: true })
  await q.addColumn('tracks', 'holder', { type: DataTypes.STRING(42), allowNull: true })

  await q.removeColumn('ducks', 'token_id')
  await q.removeColumn('ducks', 'tx_hash')
  await q.sequelize.query("UPDATE ducks SET status = 'egg' WHERE status IN ('hatching', 'failed')")

  await q.addColumn('races', 'engine_version', { type: DataTypes.STRING(66), allowNull: true })
  await q.addColumn('races', 'participants_root', { type: DataTypes.STRING(66), allowNull: true })
  await q.addColumn('races', 'layout_version', { type: DataTypes.INTEGER, allowNull: true })
}

export const down: Migration = async ({ context: q }) => {
  await q.removeColumn('races', 'layout_version')
  await q.removeColumn('races', 'participants_root')
  await q.removeColumn('races', 'engine_version')
  await q.addColumn('ducks', 'tx_hash', { type: DataTypes.STRING(66), allowNull: true })
  await q.addColumn('ducks', 'token_id', { type: DataTypes.STRING(78), allowNull: true })
  await q.removeColumn('tracks', 'holder')
  await q.removeColumn('tracks', 'layout_hash')
  await q.removeColumn('tracks', 'layout_version')
  await q.removeColumn('tracks', 'segments')
  await q.removeColumn('part_types', 'stats')
  await q.removeColumn('part_types', 'color')
  await q.addColumn('part_types', 'rarity', { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'COMMON' })
}
