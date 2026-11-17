'use client'

import { useSyncExternalStore } from 'react'

const WIDE_QUERY = '(min-width: 1024px)'

export function useWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mediaQuery = window.matchMedia(WIDE_QUERY)

      mediaQuery.addEventListener('change', onChange)

      return () => mediaQuery.removeEventListener('change', onChange)
    },
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  )
}
