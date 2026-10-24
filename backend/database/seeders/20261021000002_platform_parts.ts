import type { Migration } from '../umzug'

const PLATFORM = '0x0000000000000000000000000000000000000000'
const now = new Date()
const part = (type_id: number, name: string, rarity: string, slot: string, speed: number, weight: number, boost: number, fit: Record<string, number>) => ({
  type_id, name, rarity, slot, speed, weight, boost, fit: JSON.stringify(fit), price: 1_000_000, creator: PLATFORM, platform: true, status: 'active', created_at: now, updated_at: now,
})

// type_id must match PartNFT.createPlatformPart order in smart-contract/script/Deploy.s.sol
export const up: Migration = async ({ context: q }) => {
  await q.bulkInsert('part_types', [
    // fit = podium share per track from test/engine/search.script.ts (200 races x 120 ducks), 3 = best
    part(0, 'Buroq Wings', 'RARE', 'wings', 2, 0, -1, { 'alpine-ring': 3, 'kali-code-sprint': 2 }),
    part(1, 'Turbo Tail', 'COMMON', 'tail', 1, 1, 0, { 'alpine-ring': 2, 'kali-code-sprint': 2 }),
    part(2, 'Iron Bill', 'EPIC', 'bill', -1, 1, 2, { 'alpine-ring': 1, 'kali-code-sprint': 3 }),
  ])
}

export const down: Migration = async ({ context: q }) => {
  await q.bulkDelete('part_types', {})
}
