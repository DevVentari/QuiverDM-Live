'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { PartyPanel } from '@/components/play/party-panel';
import { SessionRecapCard } from '@/components/play/session-recap-card';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';

export default function PlayCampaignHubPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = trpc.play.getCampaignHub.useQuery({ slug });

  if (isLoading) return <div className="p-6 animate-pulse space-y-4"><div className="h-32 bg-white/5 rounded-lg" /><div className="h-24 bg-white/5 rounded-lg" /></div>;
  if (!data) return null;

  const lastSession = data.sessions[0] ?? null;
  const liveSession = data.sessions.find(s => s.status === 'in_progress');

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
      <div className="relative h-32 rounded-lg overflow-hidden bg-gradient-to-br from-indigo-950 to-black mb-2">
        {data.bannerUrl && <img src={data.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />}
        <div className="absolute inset-0 p-4 flex flex-col justify-end">
          <p className="overline-label text-amber-400/70">Campaign</p>
          <h1 className="font-display text-xl font-bold">{data.name}</h1>
        </div>
      </div>
      {liveSession && (
        <div className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <div className="flex items-center gap-2 text-red-400">
            <Zap className="h-4 w-4" />
            <span className="text-sm font-medium">Session in progress: {liveSession.title}</span>
          </div>
          <Button size="sm" variant="destructive" asChild>
            <Link href={`/play/${slug}/session`}>Join Live</Link>
          </Button>
        </div>
      )}
      <PartyPanel members={data.members} />
      {lastSession && (
        <SessionRecapCard
          sessionId={lastSession.id}
          slug={slug}
          title={lastSession.title ?? ''}
          date={lastSession.date ? String(lastSession.date) : null}
          aiSummary={lastSession.aiSummary ?? null}
        />
      )}
    </div>
  );
}
