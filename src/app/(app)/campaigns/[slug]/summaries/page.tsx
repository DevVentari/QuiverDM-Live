'use client';

import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { Sparkles, Calendar } from 'lucide-react';
import { useCampaign } from '@/components/campaign/campaign-context';
import { trpc } from '@/lib/trpc';
import { Card, Pill } from '@/components/primitives';

type SessionSummaryListItem = {
  id: string;
  sessionNumber: number;
  title: string | null;
  date: Date;
  aiSummary: string | null;
  aiSummaryStatus: string;
};

export default function SummariesPage() {
  const { campaignId, slug } = useCampaign();
  const { data: sessions, isLoading } =
    trpc.sessions.getSessionsWithSummaries.useQuery({ campaignId });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-40 animate-pulse bg-[var(--q-surface-utility)] border border-[var(--q-border-subtle)] rounded-sm" />
        ))}
      </div>
    );
  }

  const sessionList = (sessions ?? []) as SessionSummaryListItem[];
  const withSummaries = sessionList.filter((session) => session.aiSummaryStatus === 'done');
  const pending = sessionList.filter((session) => session.aiSummaryStatus !== 'done');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-[var(--q-amber)]" />
        <h1 className="text-2xl font-[var(--q-font-display)] tracking-wide text-[var(--q-text)]">Session Summaries</h1>
        <Pill variant="neutral">{withSummaries.length} summaries</Pill>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {withSummaries.map((session) => (
          <Link key={session.id} href={`/campaigns/${slug}/sessions/${session.id}`}>
            <Card
              variant="detail"
              className="h-full hover:border-[var(--q-amber-border)] transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2 border-b border-[var(--q-border-subtle)] pb-2 mb-3">
                <span className="font-[var(--q-font-display)] text-sm tracking-wide text-[var(--q-text)]">
                  Session {session.sessionNumber}
                  {session.title ? `: ${session.title}` : ''}
                </span>
                <Pill variant="neutral" className="shrink-0">
                  <Calendar className="h-3 w-3 mr-1" />
                  {format(new Date(session.date), 'MMM d')}
                </Pill>
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert line-clamp-6 text-sm text-[var(--q-text-dim)]">
                <ReactMarkdown>
                  {session.aiSummary
                    ? `${session.aiSummary.slice(0, 300)}...`
                    : 'No summary text available.'}
                </ReactMarkdown>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {pending.length > 0 && (
        <div>
          <p className="text-sm text-[var(--q-text-dim)] mb-2">
            Sessions without summaries ({pending.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {pending.map((session) => (
              <Link key={session.id} href={`/campaigns/${slug}/sessions/${session.id}`}>
                <Pill variant="neutral" className="cursor-pointer hover:bg-[var(--q-amber-trace)] hover:border-[var(--q-amber-border)]">
                  Session {session.sessionNumber}
                </Pill>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
