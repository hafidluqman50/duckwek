import { DataTypes } from 'sequelize'
import type { Migration } from '../umzug'

const timestamps = { created_at: { type: DataTypes.DATE, allowNull: false }, updated_at: { type: DataTypes.DATE, allowNull: false } }

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.createTable('tracks', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    token_id: { type: DataTypes.INTEGER, allowNull: true },
    slug: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(64), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    creator: { type: DataTypes.STRING(42), allowNull: false },
    platform: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    rent_price: { type: DataTypes.BIGINT, allowNull: false },
    laps: { type: DataTypes.INTEGER, allowNull: false },
    turns: { type: DataTypes.INTEGER, allowNull: false },
    length_m: { type: DataTypes.INTEGER, allowNull: false },
    closed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    path: { type: DataTypes.JSONB, allowNull: false },
    sectors: { type: DataTypes.JSONB, allowNull: false },
    profile: { type: DataTypes.JSONB, allowNull: false },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'active' },
    ...timestamps,
  })
  await queryInterface.createTable('part_types', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    type_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    name: { type: DataTypes.STRING(64), allowNull: false },
    rarity: { type: DataTypes.STRING(16), allowNull: false },
    slot: { type: DataTypes.STRING(16), allowNull: false },
    speed: { type: DataTypes.INTEGER, allowNull: false },
    weight: { type: DataTypes.INTEGER, allowNull: false },
    boost: { type: DataTypes.INTEGER, allowNull: false },
    fit: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    price: { type: DataTypes.BIGINT, allowNull: false },
    creator: { type: DataTypes.STRING(42), allowNull: false },
    platform: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'active' },
    ...timestamps,
  })
}

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('part_types')
  await queryInterface.dropTable('tracks')
}
