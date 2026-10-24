import 'dotenv/config'
import path from 'path'
import { Umzug, SequelizeStorage } from 'umzug'
import { QueryInterface } from 'sequelize'
import { sequelize } from '../config/database'

export type Migration = (params: { context: QueryInterface }) => Promise<void>

const make = (glob: string, table: string) =>
  new Umzug({
    migrations: {
      glob: path.join(__dirname, glob),
      resolve: ({ name, path: p, context }) => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const m = require(p as string)
        return { name, up: async () => m.up({ context }), down: async () => m.down({ context }) }
      },
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize, tableName: table }),
    logger: console,
  })

export const migrator = make('migrations/*.{ts,js}', 'sequelize_meta')
export const seeder = make('seeders/*.{ts,js}', 'sequelize_seeds')
