// Copy lint (plan 0014 DoD 9): banned words in UI source. Denial phrases are allowed.
//   node __tests__/copylint.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const BANNED = /\b(bets?|betting|stakes?|staking|jackpot|prize pool|rare|epic|rarity|duck nft)\b/gi
const ALLOW = [/no prize pool/gi, /no betting\.?( ever\.?)?/gi, /nothing flows from losers to winners/gi]
// Scope = the 0014 surfaces. Existing Garage / My Duck copy (Duck NFT, rarity) is removed by plan 0013, not here.
const roots = ['components/landing', 'components/stage', 'app/page.tsx', 'app/play/create', 'components/play/GridSlot.tsx']
const ALL = process.env.ALL ? ['app', 'components', 'lib'] : roots
const files = []
const walk = (d) => { if (!statSync(d).isDirectory()) return /\.(tsx?|css)$/.test(d) && files.push(d); for (const f of readdirSync(d)) walk(join(d, f)) }
ALL.forEach(walk)

let bad = 0
for (const f of files) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    let l = line
    for (const a of ALLOW) l = l.replace(a, '')
    const m = l.match(BANNED)
    if (m) { bad++; console.log(`${f}:${i + 1}  ${m.join(', ')}  | ${line.trim().slice(0, 120)}`) }
  })
}
console.log(bad ? `${bad} line(s) with banned words` : 'copy lint ok')
process.exit(bad ? 1 : 0)
