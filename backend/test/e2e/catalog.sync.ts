/**
 * One-off: reads the catalog from the chain into the database the env points at (what the server does at boot), and prints it.
 *   DOTENV_CONFIG_PATH=.env.staging npx ts-node -T -r tsconfig-paths/register test/e2e/catalog.sync.ts
 */
import 'dotenv/config'
import { sequelize } from '../../config/database'
import '../../app/Models/index'
import { syncCatalog } from '../../app/Chain/CatalogSync'
import { PartType } from '../../app/Models/PartType'
import { Track } from '../../app/Models/Track'

;(async () => {
  console.log('db user:', process.env.PGUSER)
  console.log(await syncCatalog())
  for (const p of await PartType.findAll({ order: [['type_id', 'ASC']] })) console.log('part', p.type_id, p.name, p.slot, JSON.stringify(p.stats), '#' + p.color.toString(16).padStart(6, '0'), p.status, p.price)
  for (const t of await Track.findAll({ order: [['id', 'ASC']] })) console.log('track', t.token_id, t.slug, t.name, `${t.turns} turns ${t.length_m} m ${t.laps} laps`, 'closed', t.closed, 'v' + t.layout_version, 'path', t.path.length, JSON.stringify(t.profile), 'holder', t.holder?.slice(0, 8), t.status)
  await sequelize.close()
})().catch((e) => { console.error(e); process.exit(1) })
