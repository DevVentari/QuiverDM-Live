import { redirect } from 'next/navigation';

export default async function NewNPCPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/campaigns/${slug}/npcs?create=true`);
}
