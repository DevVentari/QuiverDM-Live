import { redirect } from 'next/navigation';

export default async function RecapRedirectPage({ params }: { params: Promise<{ slug: string; sessionId: string }> }) {
  const { slug, sessionId } = await params;
  redirect(`/campaigns/${slug}/sessions/${sessionId}`);
}
