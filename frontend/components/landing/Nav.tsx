'use client'

import Link from 'next/link'
import { useState } from 'react'

const LINKS = [
  ['#how', 'How it works'],
  ['#host', 'Host a room'],
  ['#garage', 'Garage'],
  ['#contracts', 'Contracts'],
] as const

export function Nav() {
  const [open, setOpen] = useState(false)
  return (
    <header className="relative mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-4 md:px-6 md:py-[22px]">
      <a href="#top" className="stk-s font-display text-[26px] text-duck no-underline md:text-[34px]">DUCKWEK</a>
      <nav aria-label="Main" className="hidden items-center gap-[22px] text-base font-extrabold md:flex">
        {LINKS.map(([href, label]) => (
          <a key={href} href={href} className="text-lilac no-underline hover:text-white">{label}</a>
        ))}
        <Link href="/play" className="inline-flex h-12 items-center rounded-full border-4 border-black bg-duck px-[22px] font-black text-ink no-underline shadow-[0_5px_0_#000]">Play now</Link>
      </nav>
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-black bg-white shadow-[0_4px_0_#000] md:hidden"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d={open ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'} stroke="#1E1446" strokeWidth="3" strokeLinecap="round" /></svg>
      </button>
      {open && (
        <nav aria-label="Menu" className="absolute left-4 right-4 top-[68px] z-20 flex flex-col gap-1 rounded-3xl border-4 border-black bg-ink p-3 shadow-[0_8px_0_#000] md:hidden">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-base font-extrabold text-lilac no-underline">{label}</a>
          ))}
          <Link href="/play" className="mt-1 inline-flex h-12 items-center justify-center rounded-full border-4 border-black bg-duck font-black text-ink no-underline shadow-[0_5px_0_#000]">Play now</Link>
        </nav>
      )}
    </header>
  )
}
