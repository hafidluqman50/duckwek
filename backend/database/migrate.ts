import { migrator } from './umzug'
import { sequelize } from '../config/database'

const run = async () => {
  const cmd = process.argv[2] || 'up'
  if (cmd === 'down') await migrator.down()
  else if (cmd === 'reset') await migrator.down({ to: 0 })
  else await migrator.up()
  await sequelize.close()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
