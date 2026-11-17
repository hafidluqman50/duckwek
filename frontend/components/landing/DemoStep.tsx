'use client'

import { useEffect, useState } from 'react'

export function DemoStep() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const interval = setInterval(() => setStep((current) => (current + 1) % 100), 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div aria-hidden="true" className="absolute left-3 top-4 rotate-180 font-mono text-[13px] font-bold text-ink [writing-mode:vertical-rl] md:left-3.5">
      DEMO · STEP {String(step).padStart(2, '0')}
    </div>
  )
}
