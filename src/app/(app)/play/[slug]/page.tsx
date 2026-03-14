'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { PartyPanel } from '@/components/play/party-panel';
import { SessionRecapCard } from '@/components/play/session-recap-card';
import { Button } from '@/components/ui/button';
import { CalendarDays, Zap } from 'lucide-react';

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
          {data.character && (
            <p className="text-xs text-amber-300/70 mt-0.5">
              {data.character.name}{data.character.class ? ` · ${data.character.class}` : ''} · Lv {data.character.level}
            </p>
          )}
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
      {!liveSession && data.nextSession && (
        <div className="flex items-start gap-3 rounded-lg border border-white/8 bg-white/3 px-4 py-3">
          <CalendarDays className="h-4 w-4 text-amber-400/70 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Next Session</p>
            <p className="text-sm font-medium text-foreground truncate">{data.nextSession.title ?? 'Untitled Session'}</p>
            {data.nextSession.date && (
              <p className="text-xs text-amber-400/70">{new Date(data.nextSession.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
            )}
            {data.nextSession.quickNotes && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{data.nextSession.quickNotes}</p>
            )}
          </div>
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
