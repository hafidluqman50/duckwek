'use client'

import { useRef, type ReactNode } from 'react'
import { useScrollStory } from '@/lib/useScrollStory'

/** Client boundary only for motion; the sections inside stay server-rendered. */
export function ScrollStory({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollStory(ref)
  return <div ref={ref}>{children}</div>
}
