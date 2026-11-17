/** Canvas duck sprites shared by the stage race layer and the starting grid (moved out of app/stage/[code]/ui.tsx). */
const DUCK_BODY = '10,60 30,40 70,38 100,50 95,75 60,88 25,84'
const DUCK_HEAD = '70,40 72,18 88,8 102,16 104,36 92,46'
const DUCK_BILL = '102,20 119,27 102,34'
const SPRITE_PX = 3 // sprite resolution per design unit: sharp up to the largest duck on a 4K screen
const sprites = new Map<string, HTMLCanvasElement>()
const poly = (ctx: CanvasRenderingContext2D, pts: string) => {
  const a = pts.split(' ').map((q) => q.split(',').map(Number))
  ctx.beginPath()
  ctx.moveTo(a[0][0], a[0][1])
  for (let k = 1; k < a.length; k++) ctx.lineTo(a[k][0], a[k][1])
  ctx.closePath()
}
/** One duck in its colour, drawn once into its own small canvas (the same polygons as MiniDuck, stroke 7). */
export function spriteOf(color: string): HTMLCanvasElement {
  let c = sprites.get(color)
  if (c) return c
  c = document.createElement('canvas')
  c.width = 120 * SPRITE_PX
  c.height = 100 * SPRITE_PX
  const ctx = c.getContext('2d')!
  ctx.scale(SPRITE_PX, SPRITE_PX)
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 7
  ctx.fillStyle = color
  poly(ctx, DUCK_BODY); ctx.fill(); ctx.stroke()
  poly(ctx, DUCK_HEAD); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#FF9F1C'
  ctx.lineWidth = 6
  poly(ctx, DUCK_BILL); ctx.fill(); ctx.stroke()
  sprites.set(color, c)
  return c
}
