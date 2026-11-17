import 'dotenv/config'
import path from 'path'
import { Umzug, SequelizeStorage } from 'umzug'
import { QueryInterface } from 'sequelize'
import { sequelize } from '../config/database'

export type Migration = (params: { context: QueryInterface }) => Promise<void>

const createUmzug = (glob: string, table: string) =>
  new Umzug({
    migrations: {
      glob: path.join(__dirname, glob),
      resolve: ({ name, path: migrationPath, context }) => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const migration = require(migrationPath as string)

        return { name, up: async () => migration.up({ context }), down: async () => migration.down({ context }) }
      },
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize, tableName: table }),
    logger: console,
  })

export const migrator = createUmzug('migrations/*.{ts,js}', 'sequelize_meta')
export const seeder = createUmzug('seeders/*.{ts,js}', 'sequelize_seeds')
