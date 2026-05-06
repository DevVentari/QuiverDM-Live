'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { ScrollText, Zap } from 'lucide-react';

export default function PlaySessionsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = trpc.play.getCampaignHub.useQuery({ slug });

  if (isLoading) return (
    <div className="p-5 space-y-2 animate-pulse">
      {[1,2,3,4,5].map(i => <div key={i} className="h-[68px] bg-white/5 rounded-sm" />)}
    </div>
  );

  return (
    <div className="pb-20 px-5 pt-4 space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: 'hsl(35 80% 48%)' }}>
          Campaign
        </p>
        <h1 className="font-display text-lg font-bold" style={{ color: 'hsl(35 20% 88%)' }}>
          Session Recaps
        </h1>
      </div>

      {!data?.sessions.length ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-12 h-12 rounded-sm flex items-center justify-center"
            style={{ background: 'hsl(35 50% 14%)', border: '1px solid hsl(35 50% 22%)' }}>
            <ScrollText className="h-5 w-5" style={{ color: 'hsl(35 60% 45%)' }} />
          </div>
          <p className="text-sm" style={{ color: 'hsl(35 10% 40%)' }}>No sessions yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(data.sessions as any[]).map((s: any, i: number) => {
            const isLive = s.status === 'in_progress';
            const num = data.sessions.length - i;
            return (
              <Link key={s.id} href={isLive ? `/play/${slug}/session` : `/play/${slug}/sessions/${s.id}`}>
                <div className="flex items-center gap-3 px-3.5 py-3 rounded-sm"
                  style={{
                    background: 'linear-gradient(180deg, hsl(240 10% 11%) 0%, hsl(240 8% 8%) 100%)',
                    border: '1px solid hsl(35 35% 18%)',
                    boxShadow: 'inset 0 1px 0 hsl(35 60% 50% / 0.06)',
                  }}>
                  <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-sm text-sm font-bold"
                    style={{ background: 'hsl(35 70% 18%)', border: '1px solid hsl(35 60% 32%)', color: 'hsl(35 80% 65%)' }}>
                    {isLive ? <Zap className="h-4 w-4" /> : num}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'hsl(35 20% 88%)' }}>
                      {s.title ?? `Session ${num}`}
                    </p>
                    {s.date && (
                      <p className="text-[11px] mt-0.5" style={{ color: 'hsl(35 10% 48%)' }}>
                        {new Date(s.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  {isLive ? (
                    <span className="shrink-0 text-[9px] font-bold tracking-wide uppercase px-2 py-1 rounded-full"
                      style={{ background: 'hsl(0 62% 42% / 0.2)', border: '1px solid hsl(0 62% 42% / 0.35)', color: 'hsl(0 80% 70%)' }}>
                      Live
                    </span>
                  ) : s.status === 'completed' ? (
                    <span className="shrink-0 text-[9px] font-bold tracking-wide uppercase px-2 py-1 rounded-full"
                      style={{ background: 'hsl(145 50% 40% / 0.15)', border: '1px solid hsl(145 50% 40% / 0.3)', color: 'hsl(145 60% 65%)' }}>
                      Done
                    </span>
                  ) : (
                    <span className="shrink-0 text-[9px] font-bold tracking-wide uppercase px-2 py-1 rounded-full"
                      style={{ background: 'hsl(35 80% 48% / 0.12)', border: '1px solid hsl(35 80% 48% / 0.25)', color: 'hsl(35 80% 65%)' }}>
                      Draft
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
