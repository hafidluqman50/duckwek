/**
 * ABI drift check: every function, event and error the backend calls (app/Chain/abis.ts) must exist, with the same
 * selector, in the ABI that forge built (exported by smart-contract/script/export-abi.sh). Run after every contract change.
 *   npx ts-node -T -r tsconfig-paths/register test/e2e/abi.check.ts
 */
import fs from 'fs'
import path from 'path'
import { toEventSelector, toFunctionSelector, type Abi, type AbiItem } from 'viem'
import { badgeAbi, raceAbi, usdcAbi, vaultAbi } from '../../app/Chain/abis'

const sel = (it: AbiItem): string | null => {
  if (it.type === 'function' || it.type === 'error') return toFunctionSelector(it as any)
  if (it.type === 'event') return toEventSelector(it as any)
  return null
}
const key = (it: AbiItem) => `${it.type}:${sel(it)}`
const load = (name: string): Abi => JSON.parse(fs.readFileSync(path.join(__dirname, 'abi', `${name}.json`), 'utf8'))

let bad = 0
for (const [name, ours, built] of [
  ['DuckWekRace', raceAbi, load('DuckWekRace')],
  ['DuckWekVault', vaultAbi, load('DuckWekVault')],
  ['MockUSDC', usdcAbi, load('MockUSDC')],
  ['Badge', badgeAbi, load('Badge')],
] as const) {
  const have = new Set(built.map(key))
  for (const it of ours as Abi) {
    if (it.type === 'constructor' || it.type === 'fallback' || it.type === 'receive') continue
    if (!have.has(key(it))) {
      bad++
      console.error(`MISSING in ${name}: ${it.type} ${(it as any).name}(${((it as any).inputs || []).map((i: any) => i.type).join(',')})`)
    }
  }
}
if (bad) {
  console.error(`${bad} signature(s) in backend/app/Chain/abis.ts are not in the built contracts`)
  process.exit(1)
}
console.log('PASS abi check: every signature the backend uses exists in the built contracts')
