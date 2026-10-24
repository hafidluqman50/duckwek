import { DataTypes } from 'sequelize'
import type { Migration } from '../umzug'

const ts = { created_at: { type: DataTypes.DATE, allowNull: false }, updated_at: { type: DataTypes.DATE, allowNull: false } }

export const up: Migration = async ({ context: q }) => {
  await q.createTable('players', {
    address: { type: DataTypes.STRING(42), primaryKey: true },
    name: { type: DataTypes.STRING(32), allowNull: false },
    ...ts,
  })
  await q.createTable('auth_nonces', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    address: { type: DataTypes.STRING(42), allowNull: false },
    nonce: { type: DataTypes.STRING(64), allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    used: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    ...ts,
  })
  await q.addIndex('auth_nonces', ['address', 'nonce'])
}

export const down: Migration = async ({ context: q }) => {
  await q.dropTable('auth_nonces')
  await q.dropTable('players')
}
