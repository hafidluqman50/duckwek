import { Sequelize } from 'sequelize'

export const sequelize = new Sequelize(
  process.env.PGDATABASE || 'duckwek',
  process.env.PGUSER || 'postgres',
  process.env.PGPASSWORD || '',
  {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    dialect: 'postgres',
    logging: false,
    define: { underscored: true, timestamps: true },
    pool: { max: 8, min: 2, idle: 30_000 },
    dialectOptions: process.env.PGSSL === 'true' ? { ssl: { require: true, rejectUnauthorized: false } } : {},
  },
)

export const connectDatabase = async (): Promise<void> => {
  try {
    await sequelize.authenticate()
    console.log('======================== DATABASE CONNECTED! ========================')
  } catch (error) {
    console.log('======================== DATABASE DISCONNECTED! ========================')

    throw error
  }
}
