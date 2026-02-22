'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useCampaign } from '@/components/campaign/campaign-context';
import { EncounterBuilder } from '@/components/encounter/encounter-builder';

export default function EncounterBuilderPage() {
  const { planId } = useParams<{ planId: string }>();
  const { campaignId, slug } = useCampaign();

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href={`/campaigns/${slug}`} className="hover:text-foreground">
          Campaign
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/campaigns/${slug}/encounters`} className="hover:text-foreground">
          Encounters
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">Builder</span>
      </nav>

      <EncounterBuilder
        campaignId={campaignId}
        planId={planId}
        campaignSlug={slug}
      />
    </div>
  );
}
