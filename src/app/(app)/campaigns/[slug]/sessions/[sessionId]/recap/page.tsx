import { redirect } from 'next/navigation';

export default function RecapRedirectPage({ params }: { params: { slug: string; sessionId: string } }) {
  redirect(`/campaigns/${params.slug}/sessions/${params.sessionId}`);
}
