import fs from 'fs'
import path from 'path'
import { toEventSelector, toFunctionSelector, type Abi, type AbiItem } from 'viem'
import { badgeAbi, raceAbi, usdcAbi, vaultAbi } from '../../app/Chain/abis'

const selectorOf = (item: AbiItem): string | null => {
  if (item.type === 'function' || item.type === 'error') return toFunctionSelector(item as any)

  if (item.type === 'event') return toEventSelector(item as any)

  return null
}

const keyOf = (item: AbiItem) => `${item.type}:${selectorOf(item)}`

const loadBuiltAbi = (name: string): Abi => JSON.parse(fs.readFileSync(path.join(__dirname, 'abi', `${name}.json`), 'utf8'))

let missingCount = 0
for (const [name, backendAbi, builtAbi] of [
  ['DuckWekRace', raceAbi, loadBuiltAbi('DuckWekRace')],
  ['DuckWekVault', vaultAbi, loadBuiltAbi('DuckWekVault')],
  ['MockUSDC', usdcAbi, loadBuiltAbi('MockUSDC')],
  ['Badge', badgeAbi, loadBuiltAbi('Badge')],
] as const) {
  const builtKeys = new Set(builtAbi.map(keyOf))
  for (const item of backendAbi as Abi) {
    if (item.type === 'constructor' || item.type === 'fallback' || item.type === 'receive') continue

    if (!builtKeys.has(keyOf(item))) {
      missingCount++
      console.error(`MISSING in ${name}: ${item.type} ${(item as any).name}(${((item as any).inputs || []).map((input: any) => input.type).join(',')})`)
    }
  }
}

if (missingCount) {
  console.error(`${missingCount} signature(s) in backend/app/Chain/abis.ts are not in the built contracts`)
  process.exit(1)
}

console.log('PASS abi check: every signature the backend uses exists in the built contracts')
