import { DataTypes } from 'sequelize'
import type { Migration } from '../umzug'

// The cheer log of a race (plan §3.10): step to (duck index to accepted taps), and its hash, which is folded into the standing root.
export const up: Migration = async ({ context: q }) => {
  await q.addColumn('races', 'cheers', { type: DataTypes.JSONB, allowNull: false, defaultValue: {} })
  await q.addColumn('races', 'cheers_root', { type: DataTypes.STRING(66), allowNull: true })
}

export const down: Migration = async ({ context: q }) => {
  await q.removeColumn('races', 'cheers_root')
  await q.removeColumn('races', 'cheers')
}
