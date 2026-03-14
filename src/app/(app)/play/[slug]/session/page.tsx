'use client';

import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { LiveSession } from '@/components/play/live-session';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function PlayLiveSessionPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data } = trpc.play.getCampaignHub.useQuery({ slug });

  const liveSession = data?.sessions.find(s => s.status === 'in_progress');

  if (!data) return <div className="p-6 animate-pulse h-screen bg-background" />;

  if (!liveSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-6">
        <p className="text-muted-foreground mb-4">No session is currently in progress.</p>
        <Button variant="outline" asChild>
          <Link href={`/play/${slug}`}>Back to Hub</Link>
        </Button>
      </div>
    );
  }

  return <LiveSession campaignId={data.id} sessionId={liveSession.id} />;
}
