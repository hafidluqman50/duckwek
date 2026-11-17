import { seeder } from './umzug'
import { sequelize } from '../config/database'

seeder
  .up()
  .then(() => sequelize.close())
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
