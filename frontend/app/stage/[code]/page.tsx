import { StagePage } from './ui'

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <StagePage code={code.toUpperCase()} />
}
