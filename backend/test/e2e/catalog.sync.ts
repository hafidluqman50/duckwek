import 'dotenv/config'
import { sequelize } from '../../config/database'
import '../../app/Models/index'
import { syncCatalog } from '../../app/Chain/CatalogSync'
import { PartType } from '../../app/Models/PartType'
import { Track } from '../../app/Models/Track'

;(async () => {
  console.log('db user:', process.env.PGUSER)
  console.log(await syncCatalog())

  for (const part of await PartType.findAll({ order: [['type_id', 'ASC']] })) {
    console.log('part', part.type_id, part.name, part.slot, JSON.stringify(part.stats), '#' + part.color.toString(16).padStart(6, '0'), part.status, part.price)
  }

  for (const track of await Track.findAll({ order: [['id', 'ASC']] })) {
    console.log('track', track.token_id, track.slug, track.name, `${track.turns} turns ${track.length_m} m ${track.laps} laps`, 'closed', track.closed, 'v' + track.layout_version, 'path', track.path.length, JSON.stringify(track.profile), 'holder', track.holder?.slice(0, 8), track.status)
  }

  await sequelize.close()
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
