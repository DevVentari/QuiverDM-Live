import { redirect } from 'next/navigation';

export default async function UploadRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string; slug?: string }>;
}) {
  const { sessionId, slug } = await searchParams;
  if (sessionId && slug) {
    redirect(`/campaigns/${slug}/sessions/${sessionId}`);
  }
  redirect('/campaigns');
}
