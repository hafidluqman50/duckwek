'use client'

import { useSyncExternalStore } from 'react'

const Q = '(min-width: 1024px)'

/** True at >= 1024px: the laptop layout of /play (plan 0014 §3.2). Below it nothing changes. */
export function useWide(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(Q)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(Q).matches,
    () => false,
  )
}
