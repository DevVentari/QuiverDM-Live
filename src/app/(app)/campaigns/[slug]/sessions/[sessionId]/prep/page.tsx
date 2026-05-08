import { permanentRedirect } from 'next/navigation'
export default async function OldPrepPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  permanentRedirect(`/session/${sessionId}`)
}
