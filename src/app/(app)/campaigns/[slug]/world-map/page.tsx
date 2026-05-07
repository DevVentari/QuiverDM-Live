import { BentoCanvas } from '@/components/layout/bento-canvas';
import { WorldMapCanvas } from '@/components/world/world-map-canvas';

interface WorldMapPageProps {
  params: Promise<{ slug: string }>;
}

export default async function WorldMapPage({ params }: WorldMapPageProps) {
  const { slug } = await params;
  return (
    <BentoCanvas overline="Campaign" title="World Map">
      <WorldMapCanvas slug={slug} />
    </BentoCanvas>
  );
}
