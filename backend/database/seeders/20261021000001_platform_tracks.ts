import type { Migration } from '../umzug'
import { ALPINE_RING_PATH, ALPINE_RING_SECTORS, KALI_CODE_PATH, KALI_CODE_SECTORS } from '../../app/Engine/TrackGeometry'

const PLATFORM = '0x0000000000000000000000000000000000000000'
const now = new Date()

export const up: Migration = async ({ context: q }) => {
  await q.bulkInsert('tracks', [
    {
      token_id: 1,
      slug: 'kali-code-sprint',
      name: 'Kali Code Sprint',
      description: 'Point-to-point river sprint with six bends. Twisty: weight works as grip.',
      creator: PLATFORM,
      platform: true,
      rent_price: 1_000_000,
      laps: 1,
      turns: 6,
      length_m: 1800,
      closed: false,
      path: JSON.stringify(KALI_CODE_PATH),
      sectors: JSON.stringify(KALI_CODE_SECTORS),
      profile: JSON.stringify({ speed: 0.8, weight: 0.4, boost: 1, lapTicks: 35 }),
      status: 'active',
      created_at: now,
      updated_at: now,
    },
    {
      token_id: 2,
      slug: 'alpine-ring',
      name: 'Alpine Ring',
      description: '10-turn mountain circuit modelled on the Red Bull Ring layout. Long straights reward speed; heavy ducks pay for it.',
      creator: PLATFORM,
      platform: true,
      rent_price: 1_000_000,
      laps: 2,
      turns: 10,
      length_m: 4326,
      closed: true,
      path: JSON.stringify(ALPINE_RING_PATH),
      sectors: JSON.stringify(ALPINE_RING_SECTORS),
      profile: JSON.stringify({ speed: 1.2, weight: 0.9, boost: 1, lapTicks: 40 }),
      status: 'active',
      created_at: now,
      updated_at: now,
    },
    {
      token_id: null,
      slug: 'custom-track',
      name: 'Custom track',
      description: 'Design your own track, rent it to hosts, earn 50% of every rental. Coming soon.',
      creator: PLATFORM,
      platform: false,
      rent_price: 0,
      laps: 1,
      turns: 0,
      length_m: 0,
      closed: false,
      path: JSON.stringify([]),
      sectors: JSON.stringify([]),
      profile: JSON.stringify({ speed: 1, weight: 1, boost: 1, lapTicks: 35 }),
      status: 'coming_soon',
      created_at: now,
      updated_at: now,
    },
  ] as any)
}

export const down: Migration = async ({ context: q }) => {
  await q.bulkDelete('tracks', {})
}
