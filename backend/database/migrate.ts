import { migrator } from './umzug'
import { sequelize } from '../config/database'

const run = async () => {
  const command = process.argv[2] || 'up'

  if (command === 'down') await migrator.down()
  else if (command === 'reset') await migrator.down({ to: 0 })
  else await migrator.up()

  await sequelize.close()
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
