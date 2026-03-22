import { redirect } from 'next/navigation';

export default async function EditNPCPage({ params }: { params: Promise<{ slug: string; npcId: string }> }) {
  const { slug, npcId } = await params;
  redirect(`/campaigns/${slug}/npcs/${npcId}`);
}
