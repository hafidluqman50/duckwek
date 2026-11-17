import { Suspense } from 'react'
import { PlayPage } from '../ui'

/** `/play/create`: the "Host a room" entry. Same app, starts on the create-room screen. */
export default function Page() {
  return (
    <Suspense>
      <PlayPage entry="create" />
    </Suspense>
  )
}
