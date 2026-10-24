import { Suspense } from 'react'
import { PlayPage } from './ui'

export default function Page() {
  return (
    <Suspense>
      <PlayPage />
    </Suspense>
  )
}
