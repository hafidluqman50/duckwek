import { redirect } from 'next/navigation'

/** QR target on the projector: duckwek.app/join/WEK-7Q2 */
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  redirect(`/play?room=${encodeURIComponent(code.toUpperCase())}`)
}
