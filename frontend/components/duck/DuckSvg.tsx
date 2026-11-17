import type { Cosmetics, Template } from '@/lib/types'

const BODY: Record<Template, string> = {
  balanced: '40,72 56,54 94,52 122,62 118,86 84,98 50,94',
  sprint: '30,66 56,56 94,54 124,62 116,82 84,92 46,88',
  tank: '42,74 52,48 96,46 126,62 122,92 84,102 46,98',
}

export interface PartArt {
  slot: 'wings' | 'tail' | 'bill'
  color: string
}
const registry = new Map<number, PartArt>()
export const registerParts = (parts: { typeId: number; slot: PartArt['slot']; color: string }[]): void => parts.forEach((part) => registry.set(part.typeId, { slot: part.slot, color: part.color }))

export interface DuckSvgProps {
  template: Template
  bodyColor: string
  billColor: string
  cosmetics?: Cosmetics
  partTypeId?: number | null
  part?: PartArt | null
  partSlot?: PartArt['slot'] | null
  partColor?: string | null
  width?: number | string
  flip?: boolean
  label?: string
  className?: string
  style?: React.CSSProperties
}

export function DuckSvg({ template, bodyColor, billColor, cosmetics, partTypeId = null, part = null, partSlot = null, partColor = null, width = 150, flip, label, className, style }: DuckSvgProps) {
  const worn = cosmetics || { hat: false, shades: false, scarf: false }
  const art = part ?? (partSlot && partColor ? { slot: partSlot, color: partColor } : partTypeId !== null ? registry.get(partTypeId) ?? null : null)

  return (
    <svg viewBox="0 0 150 105" width={width} className={className} style={{ display: 'block', overflow: 'visible', transform: flip ? 'scaleX(-1)' : undefined, ...style }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {art?.slot === 'tail' && <polygon points="36,64 6,52 16,72 6,92 38,84" fill={art.color} stroke="#000" strokeWidth="4" strokeLinejoin="round" />}
      <polygon points={BODY[template] || BODY.balanced} fill={bodyColor} stroke="#000" strokeWidth="5" strokeLinejoin="round" />
      <polygon points="52,60 90,56 72,72" fill="#fff" opacity="0.3" />
      {art?.slot === 'wings' && <polygon points="58,66 98,34 110,40 90,74" fill={art.color} stroke="#000" strokeWidth="4" strokeLinejoin="round" />}
      {worn.scarf && <polygon points="86,52 116,54 114,62 84,58" fill="#F25F5C" stroke="#000" strokeWidth="3" strokeLinejoin="round" />}
      <polygon points="88,52 90,30 106,20 120,28 122,48 110,58" fill={bodyColor} stroke="#000" strokeWidth="5" strokeLinejoin="round" />
      {worn.scarf && <polygon points="90,58 84,78 94,78 97,60" fill="#F25F5C" stroke="#000" strokeWidth="3" strokeLinejoin="round" />}
      {art?.slot === 'bill' ? (
        <polygon points="118,30 147,39 118,48" fill={art.color} stroke="#000" strokeWidth="4" strokeLinejoin="round" />
      ) : (
        <polygon points="120,32 140,39 120,46" fill={billColor} stroke="#000" strokeWidth="4" strokeLinejoin="round" />
      )}
      <circle cx="109" cy="34" r="4" fill="#000" />
      {worn.shades && <rect x="100" y="29" width="22" height="9" rx="3" fill="#000" />}
      {worn.hat && <polygon points="96,24 108,5 120,22" fill="#FF7AB6" stroke="#000" strokeWidth="4" strokeLinejoin="round" />}
    </svg>
  )
}

export function MiniDuck({ color, width = 38, flip, stroke = 6, eye = 0, className, style }: { color: string; width?: number | string; flip?: boolean; stroke?: number; eye?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 120 100" width={width} className={className} style={{ display: 'block', transform: flip ? 'scaleX(-1)' : undefined, ...style }} aria-hidden>
      <polygon points="10,60 30,40 70,38 100,50 95,75 60,88 25,84" fill={color} stroke="#000" strokeWidth={stroke} strokeLinejoin="round" />
      <polygon points="70,40 72,18 88,8 102,16 104,36 92,46" fill={color} stroke="#000" strokeWidth={stroke} strokeLinejoin="round" />
      <polygon points="102,20 119,27 102,34" fill="#FF9F1C" stroke="#000" strokeWidth={stroke - 1} />
      {eye > 0 && <circle cx="91" cy="23" r={eye} fill="#000" />}
    </svg>
  )
}
