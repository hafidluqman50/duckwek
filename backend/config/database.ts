import { Sequelize } from 'sequelize'

// Supabase (and most hosted Postgres) requires TLS: set PGSSL=true.
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
    pool: { max: 8, min: 2, idle: 30_000 }, // warm connections: a new TLS connection to a remote database costs hundreds of ms
    dialectOptions: process.env.PGSSL === 'true' ? { ssl: { require: true, rejectUnauthorized: false } } : {},
  },
)

export const connectDatabase = async (): Promise<void> => {
  try {
    await sequelize.authenticate()
    console.log('======================== DATABASE CONNECTED! ========================')
  } catch (e) {
    console.log('======================== DATABASE DISCONNECTED! ========================')
    throw e
  }
}
