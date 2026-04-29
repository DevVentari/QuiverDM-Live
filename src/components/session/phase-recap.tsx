'use client';

import { RecapCard } from '@/components/recap/recap-card';

interface PhaseRecapProps {
  session: {
    id: string;
    transcripts?: Array<{ id: string }>;
  };
  campaignId: string;
  slug: string;
}

export function PhaseRecap({ session, campaignId, slug }: PhaseRecapProps) {
  const transcriptId = session.transcripts?.[0]?.id;

  return (
    <div className="space-y-4">
      <RecapCard
        sessionId={session.id}
        campaignId={campaignId}
        transcriptId={transcriptId}
        slug={slug}
      />
    </div>
  );
}
