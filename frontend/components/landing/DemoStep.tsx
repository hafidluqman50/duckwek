'use client'

import { useEffect, useState } from 'react'

/** Decorative counter, not chain data: labelled DEMO so nobody reads it as a live block number. */
export function DemoStep() {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setN((v) => (v + 1) % 100), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div aria-hidden="true" className="absolute left-3 top-4 rotate-180 font-mono text-[13px] font-bold text-ink [writing-mode:vertical-rl] md:left-3.5">
      DEMO · STEP {String(n).padStart(2, '0')}
    </div>
  )
}
