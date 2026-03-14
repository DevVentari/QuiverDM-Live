'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { ScrollText } from 'lucide-react';

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
          {data.sessions.map(s => (
            <Link key={s.id} href={`/play/${slug}/sessions/${s.id}`}
              className="flex items-center justify-between rounded-lg border border-white/8 bg-white/3 hover:bg-white/5 px-4 py-3 transition-colors"
            >
              <div>
                <p className="text-sm font-medium">{s.title}</p>
                {s.date && <p className="text-xs text-muted-foreground">{new Date(String(s.date)).toLocaleDateString()}</p>}
              </div>
              <span className="text-xs text-muted-foreground capitalize">{s.status}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
