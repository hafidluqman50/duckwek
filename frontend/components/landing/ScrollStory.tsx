'use client'

import { useRef, type ReactNode } from 'react'
import { useScrollStory } from '@/lib/useScrollStory'

export function ScrollStory({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null)
  useScrollStory(rootRef)

  return <div ref={rootRef}>{children}</div>
}
