import { DataTypes } from 'sequelize'
import type { Migration } from '../umzug'

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.addColumn('auth_nonces', 'session_cap', { type: DataTypes.BIGINT, allowNull: false, defaultValue: 5_000_000 })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn('auth_nonces', 'session_cap')
}
