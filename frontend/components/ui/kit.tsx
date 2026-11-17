'use client'

import type { CSSProperties, ReactNode } from 'react'

type Tone = 'yellow' | 'white' | 'ink' | 'lime' | 'deep'
const TONES: Record<Tone, { bg: string; fg: string }> = {
  yellow: { bg: '#FFC93C', fg: '#1E1446' },
  white: { bg: '#ffffff', fg: '#1E1446' },
  ink: { bg: '#1E1446', fg: '#ffffff' },
  lime: { bg: '#B8F35A', fg: '#1E1446' },
  deep: { bg: '#2A1D5E', fg: '#ffffff' },
}

export function Button({ children, onClick, tone = 'yellow', height = 60, fontSize = 19, shadow = true, disabled, style, ariaLabel, ariaPressed, type = 'button', display }: {
  children: ReactNode
  onClick?: () => void
  tone?: Tone
  height?: number
  fontSize?: number
  shadow?: boolean
  disabled?: boolean
  style?: CSSProperties
  ariaLabel?: string
  ariaPressed?: boolean
  type?: 'button' | 'submit'
  display?: boolean
}) {
  const palette = TONES[tone]

  return (
    <button
      type={type}
      className="dw-btn"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      style={{ height, padding: '0 16px', background: palette.bg, color: palette.fg, border: '4px solid #000', borderRadius: Math.min(20, height / 3), boxShadow: shadow ? '0 6px 0 #000' : 'none', fontSize, fontWeight: 900, fontFamily: display ? 'var(--font-display)' : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...style }}
    >
      {children}
    </button>
  )
}

export const Kicker = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 2, ...style }}>{children}</div>
)

export const Title = ({ children, size = 36, style }: { children: ReactNode; size?: number; style?: CSSProperties }) => (
  <div className="stroke-title" style={{ fontFamily: 'var(--font-display)', fontSize: size, lineHeight: 1.02, color: '#fff', ...style }}>{children}</div>
)

export const Card = ({ children, style, tone = 'white' }: { children: ReactNode; style?: CSSProperties; tone?: 'white' | 'ink' }) => (
  <div style={{ background: tone === 'white' ? '#fff' : '#1E1446', color: tone === 'white' ? '#1E1446' : '#fff', border: '4px solid #000', borderRadius: 20, padding: '12px 14px', ...style }}>{children}</div>
)

export const Pill = ({ children, bg = '#1E1446', fg = '#fff', style }: { children: ReactNode; bg?: string; fg?: string; style?: CSSProperties }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, background: bg, color: fg, border: '3px solid #000', fontSize: 12, fontWeight: 900, ...style }}>{children}</span>
)

export const Dots = () => (
  <div style={{ display: 'flex', gap: 8 }} aria-hidden>
    {['#FFC93C', '#836EF9', '#ffffff'].map((color, index) => (
      <span key={color} style={{ animation: `dwDots .9s ease-in-out ${index * 0.15}s infinite`, width: 14, height: 14, borderRadius: '50%', background: color }} />
    ))}
  </div>
)

export function TrackThumb({ pathData, width = 96, height = 56, stroke = 70 }: { pathData: string; width?: number; height?: number; stroke?: number }) {
  return (
    <svg viewBox="-60 40 1800 960" width={width} height={height} style={{ flex: 'none', background: '#1E1446', borderRadius: 10, border: '2px solid #000' }} aria-hidden>
      <path d={pathData} fill="none" stroke="#836EF9" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
