'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PlaySessionsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data } = trpc.play.getCampaignHub.useQuery({ slug });

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <p className="overline-label mb-1">Campaign</p>
      <h1 className="font-display text-xl font-bold mb-6">Session Recaps</h1>
      {!data?.sessions.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>No sessions yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.sessions.map(s => {
            const isLive = s.status === 'in_progress';
            return (
              <Link
                key={s.id}
                href={`/play/${slug}/sessions/${s.id}`}
                className="flex items-start gap-3 rounded-lg border border-white/8 bg-white/3 hover:bg-white/5 hover:border-amber-500/20 px-4 py-3 transition-colors"
              >
                <div className="h-8 w-8 rounded-md bg-amber-500/8 border border-amber-500/15 flex items-center justify-center font-display text-sm font-bold text-amber-400/80 shrink-0 mt-0.5">
                  {s.sessionNumber ?? '—'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{s.title ?? 'Untitled Session'}</p>
                  {s.date && <p className="text-xs text-muted-foreground mt-0.5">{new Date(String(s.date)).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                  {s.aiSummary && (
                    <p className="text-xs text-muted-foreground/70 mt-1.5 line-clamp-2 leading-relaxed">{s.aiSummary}</p>
                  )}
                </div>
                <span className={cn(
                  'text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide shrink-0 mt-0.5',
                  isLive
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : s.status === 'completed'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-white/5 text-muted-foreground border border-white/10'
                )}>
                  {isLive ? 'Live' : s.status}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
