import { redirect } from 'next/navigation';

export default async function NewEncounterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/campaigns/${slug}/encounters?create=true`);
}
