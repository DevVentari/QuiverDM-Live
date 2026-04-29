import { redirect } from 'next/navigation';

export default function UploadRedirectPage({
  searchParams,
}: {
  searchParams: { sessionId?: string; slug?: string };
}) {
  if (searchParams.sessionId && searchParams.slug) {
    redirect(`/campaigns/${searchParams.slug}/sessions/${searchParams.sessionId}`);
  }
  redirect('/campaigns');
}
