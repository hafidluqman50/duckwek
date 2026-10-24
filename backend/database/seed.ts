import { seeder } from './umzug'
import { sequelize } from '../config/database'

seeder
  .up()
  .then(() => sequelize.close())
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
