import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'
import { sequelize } from '@config/database'

export type PaymentKind = 'create_room' | 'join_room' | 'buy_part' | 'withdraw' | 'faucet'
export type PaymentStatus = 'prepared' | 'pending' | 'confirmed' | 'failed'

class Payment extends Model<InferAttributes<Payment>, InferCreationAttributes<Payment>> {
  declare id: CreationOptional<number>
  declare kind: PaymentKind
  declare payer: string
  declare amount: string
  declare ref: string
  declare room_code: string | null
  declare nonce: string
  declare deadline: string
  declare tx_hash: string | null
  declare status: PaymentStatus
  declare error: string | null
  declare meta: Record<string, unknown>
  declare created_at: CreationOptional<Date>
  declare updated_at: CreationOptional<Date>
}

Payment.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    kind: { type: DataTypes.STRING(16), allowNull: false },
    payer: { type: DataTypes.STRING(42), allowNull: false },
    amount: { type: DataTypes.BIGINT, allowNull: false },
    ref: { type: DataTypes.STRING(78), allowNull: false, defaultValue: '0' },
    room_code: { type: DataTypes.STRING(12), allowNull: true },
    nonce: { type: DataTypes.STRING(78), allowNull: false },
    deadline: { type: DataTypes.BIGINT, allowNull: false },
    tx_hash: { type: DataTypes.STRING(66), allowNull: true },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'prepared' },
    error: { type: DataTypes.TEXT, allowNull: true },
    meta: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  { sequelize, tableName: 'payments' },
)

export { Payment }
