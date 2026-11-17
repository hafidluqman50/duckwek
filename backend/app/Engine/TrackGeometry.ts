type Pt = [number, number]

const bezier = (curves: Pt[][], pointsPerCurve = 16): Pt[] => {
  const points: Pt[] = []

  curves.forEach((curve, curveIndex) => {
    for (let pointIndex = curveIndex ? 1 : 0; pointIndex <= pointsPerCurve; pointIndex++) {
      const along = pointIndex / pointsPerCurve
      const remaining = 1 - along
      points.push([
        Math.round(remaining * remaining * remaining * curve[0][0] + 3 * remaining * remaining * along * curve[1][0] + 3 * remaining * along * along * curve[2][0] + along * along * along * curve[3][0]),
        Math.round(remaining * remaining * remaining * curve[0][1] + 3 * remaining * remaining * along * curve[1][1] + 3 * remaining * along * along * curve[2][1] + along * along * along * curve[3][1]),
      ])
    }
  })

  return points
}

export const KALI_CODE_PATH: Pt[] = bezier([
  [[60, 930], [300, 1000], [520, 640], [860, 720]],
  [[860, 720], [1200, 800], [1380, 1000], [1600, 760]],
  [[1600, 760], [1820, 520], [1700, 300], [1340, 260]],
  [[1340, 260], [980, 220], [760, 340], [640, 140]],
])

export const ALPINE_RING_PATH: Pt[] = [
  [1335, 700], [1200, 800], [1090, 875], [1050, 885], [1000, 850], [880, 780], [700, 650], [600, 565],
  [510, 530], [420, 470], [300, 410], [255, 385], [290, 352], [420, 290], [600, 240], [800, 195],
  [920, 155], [1010, 120], [1050, 142], [1035, 212], [990, 280], [920, 322], [780, 357], [720, 388],
  [675, 440], [692, 502], [760, 556], [850, 612], [900, 605], [935, 560], [960, 470], [1040, 410],
  [1200, 340], [1380, 265], [1470, 230], [1520, 240], [1580, 300], [1640, 385], [1610, 432], [1520, 510],
  [1420, 595],
]

export const ALPINE_RING_SECTORS = [8, 24, 41]
export const KALI_CODE_SECTORS = [16, 33, 49]
