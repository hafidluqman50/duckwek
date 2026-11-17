const DUCK_BODY = '10,60 30,40 70,38 100,50 95,75 60,88 25,84'
const DUCK_HEAD = '70,40 72,18 88,8 102,16 104,36 92,46'
const DUCK_BILL = '102,20 119,27 102,34'
const SPRITE_PX = 3
const sprites = new Map<string, HTMLCanvasElement>()

const tracePolygon = (context: CanvasRenderingContext2D, points: string) => {
  const corners = points.split(' ').map((pair) => pair.split(',').map(Number))
  context.beginPath()
  context.moveTo(corners[0][0], corners[0][1])

  for (let cornerIndex = 1; cornerIndex < corners.length; cornerIndex++) context.lineTo(corners[cornerIndex][0], corners[cornerIndex][1])

  context.closePath()
}

export function spriteForColor(color: string): HTMLCanvasElement {
  let sprite = sprites.get(color)

  if (sprite) return sprite

  sprite = document.createElement('canvas')
  sprite.width = 120 * SPRITE_PX
  sprite.height = 100 * SPRITE_PX
  const context = sprite.getContext('2d')!
  context.scale(SPRITE_PX, SPRITE_PX)
  context.lineJoin = 'round'
  context.strokeStyle = '#000'
  context.lineWidth = 7
  context.fillStyle = color
  tracePolygon(context, DUCK_BODY); context.fill(); context.stroke()
  tracePolygon(context, DUCK_HEAD); context.fill(); context.stroke()
  context.fillStyle = '#FF9F1C'
  context.lineWidth = 6
  tracePolygon(context, DUCK_BILL); context.fill(); context.stroke()
  sprites.set(color, sprite)

  return sprite
}
