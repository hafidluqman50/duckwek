import { DataTypes } from 'sequelize'
import type { Migration } from '../umzug'
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.addColumn('races', 'cheers', { type: DataTypes.JSONB, allowNull: false, defaultValue: {} })
  await queryInterface.addColumn('races', 'cheers_root', { type: DataTypes.STRING(66), allowNull: true })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn('races', 'cheers_root')
  await queryInterface.removeColumn('races', 'cheers')
}
