import { redirect } from 'next/navigation';

export default async function CampaignRootPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/campaigns/${slug}/sessions`);
}
