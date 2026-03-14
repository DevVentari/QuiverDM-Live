import Link from 'next/link';
import { Button } from '@/components/ui/button';
interface SessionRecapCardProps {
  sessionId: string;
  slug: string;
  title: string;
  date: string | null;
  aiSummary: string | null;
}
export function SessionRecapCard({ sessionId, slug, title, date, aiSummary }: SessionRecapCardProps) {
  return (
    <div className="stone-card p-4">
      <p className="overline-label mb-2">Last Session</p>
      <h3 className="font-display text-base font-semibold mb-1">{title}</h3>
      {date && (
        <p className="text-xs text-muted-foreground mb-2">
          {new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}
      {aiSummary && <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{aiSummary}</p>}
      <Button variant="outline" size="sm" asChild>
        <Link href={`/play/${slug}/sessions/${sessionId}`}>Read full recap</Link>
      </Button>
    </div>
  );
}
