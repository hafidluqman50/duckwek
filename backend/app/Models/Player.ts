import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'
import { sequelize } from '@config/database'

class Player extends Model<InferAttributes<Player>, InferCreationAttributes<Player>> {
  declare address: string
  declare name: string
  declare first_spend_at: CreationOptional<Date | null>
  declare created_at: CreationOptional<Date>
  declare updated_at: CreationOptional<Date>
}

Player.init(
  {
    address: { type: DataTypes.STRING(42), primaryKey: true },
    name: { type: DataTypes.STRING(32), allowNull: false },
    first_spend_at: { type: DataTypes.DATE, allowNull: true },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  { sequelize, tableName: 'players' },
)

export { Player }
