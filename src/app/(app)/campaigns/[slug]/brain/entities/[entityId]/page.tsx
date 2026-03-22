import { redirect } from 'next/navigation';

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ slug: string; entityId: string }>;
}) {
  const { slug, entityId } = await params;
  redirect(`/campaigns/${slug}/brain/entities?entity=${entityId}`);
}
