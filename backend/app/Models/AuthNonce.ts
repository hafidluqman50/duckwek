import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'
import { sequelize } from '@config/database'

class AuthNonce extends Model<InferAttributes<AuthNonce>, InferCreationAttributes<AuthNonce>> {
  declare id: CreationOptional<number>
  declare address: string
  declare nonce: string
  declare expires_at: Date
  declare used: CreationOptional<boolean>
  // the session (plan §3.2): the permit the player signed once at connect
  declare permit_nonce: string | null
  declare deadline: string | null
  declare signature: string | null
  declare permit_used: CreationOptional<boolean>
  declare spent: CreationOptional<string>
  declare created_at: CreationOptional<Date>
  declare updated_at: CreationOptional<Date>
}

AuthNonce.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    address: { type: DataTypes.STRING(42), allowNull: false },
    nonce: { type: DataTypes.STRING(64), allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    used: { type: DataTypes.BOOLEAN, defaultValue: false },
    permit_nonce: { type: DataTypes.STRING(78), allowNull: true },
    deadline: { type: DataTypes.BIGINT, allowNull: true },
    signature: { type: DataTypes.TEXT, allowNull: true },
    permit_used: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    spent: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  { sequelize, tableName: 'auth_nonces' },
)

export { AuthNonce }
