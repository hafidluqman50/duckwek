import { DataTypes } from 'sequelize'
import type { Migration } from '../umzug'

const timestamps = { created_at: { type: DataTypes.DATE, allowNull: false }, updated_at: { type: DataTypes.DATE, allowNull: false } }

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.createTable('players', {
    address: { type: DataTypes.STRING(42), primaryKey: true },
    name: { type: DataTypes.STRING(32), allowNull: false },
    ...timestamps,
  })
  await queryInterface.createTable('auth_nonces', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    address: { type: DataTypes.STRING(42), allowNull: false },
    nonce: { type: DataTypes.STRING(64), allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    used: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    ...timestamps,
  })
  await queryInterface.addIndex('auth_nonces', ['address', 'nonce'])
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('auth_nonces')
  await queryInterface.dropTable('players')
}
