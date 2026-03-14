'use client';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';

export default function PlaySessionRecapPage() {
  const { id } = useParams<{ slug: string; id: string }>();
  const { data, isLoading } = trpc.play.getSessionRecap.useQuery({ sessionId: id });

  if (isLoading) return <div className="p-6 animate-pulse space-y-3"><div className="h-8 w-64 bg-white/5 rounded" /><div className="h-64 bg-white/5 rounded-lg" /></div>;
  if (!data) return null;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <p className="overline-label mb-1">Session Recap</p>
      <h1 className="font-display text-2xl font-bold mb-1">{data.title}</h1>
      {data.date && (
        <p className="text-sm text-muted-foreground mb-6">
          {new Date(String(data.date)).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}
      {data.aiSummary ? (
        <div className="stone-card p-4">
          <p className="overline-label mb-3">AI Summary</p>
          <div className="whitespace-pre-wrap text-sm text-foreground/80 leading-relaxed">{data.aiSummary}</div>
        </div>
      ) : (
        <div className="stone-card p-8 text-center text-muted-foreground">
          <p>No summary available for this session yet.</p>
        </div>
      )}
    </div>
  );
}
