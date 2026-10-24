// Track centerlines in a 1920x1080 design space. The frontend turns these into a 3D ribbon
// (Catmull-Rom spline) and the phone minimap; the engine only needs lap count and profile.

type Pt = [number, number]

const bezier = (segs: Pt[][], perSeg = 16): Pt[] => {
  const out: Pt[] = []
  segs.forEach((s, si) => {
    for (let k = si ? 1 : 0; k <= perSeg; k++) {
      const t = k / perSeg
      const u = 1 - t
      out.push([
        Math.round(u * u * u * s[0][0] + 3 * u * u * t * s[1][0] + 3 * u * t * t * s[2][0] + t * t * t * s[3][0]),
        Math.round(u * u * u * s[0][1] + 3 * u * u * t * s[1][1] + 3 * u * t * t * s[2][1] + t * t * t * s[3][1]),
      ])
    }
  })
  return out
}

/** Kali Code Sprint: point-to-point river sprint, 6 bends (the original DuckWek design track). */
export const KALI_CODE_PATH: Pt[] = bezier([
  [[60, 930], [300, 1000], [520, 640], [860, 720]],
  [[860, 720], [1200, 800], [1380, 1000], [1600, 760]],
  [[1600, 760], [1820, 520], [1700, 300], [1340, 260]],
  [[1340, 260], [980, 220], [760, 340], [640, 140]],
])

/**
 * Alpine Ring: closed 10-turn circuit modelled on the layout of the Red Bull Ring
 * (Spielberg, Austria · 4.326 km · 10 turns): long uphill run to T3, fast blast to T4,
 * twisty infield T5–T8, back straight to T9–T10. Driven clockwise from the start/finish line.
 */
export const ALPINE_RING_PATH: Pt[] = [
  [1335, 700], [1200, 800], [1090, 875], [1050, 885], [1000, 850], [880, 780], [700, 650], [600, 565],
  [510, 530], [420, 470], [300, 410], [255, 385], [290, 352], [420, 290], [600, 240], [800, 195],
  [920, 155], [1010, 120], [1050, 142], [1035, 212], [990, 280], [920, 322], [780, 357], [720, 388],
  [675, 440], [692, 502], [760, 556], [850, 612], [900, 605], [935, 560], [960, 470], [1040, 410],
  [1200, 340], [1380, 265], [1470, 230], [1520, 240], [1580, 300], [1640, 385], [1610, 432], [1520, 510],
  [1420, 595],
]

/** Index of the path point where each sector ends (sector 1, 2, 3). */
export const ALPINE_RING_SECTORS = [8, 24, 41]
export const KALI_CODE_SECTORS = [16, 33, 49]
