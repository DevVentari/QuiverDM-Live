'use client';

import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { Sparkles, Calendar } from 'lucide-react';
import { useCampaign } from '@/components/campaign/campaign-context';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
          <div key={index} className="h-40 animate-pulse bg-muted rounded-lg" />
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
        <Sparkles className="h-5 w-5" />
        <h1 className="text-2xl font-bold">Session Summaries</h1>
        <Badge variant="secondary">{withSummaries.length} summaries</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {withSummaries.map((session) => (
          <Link key={session.id} href={`/campaigns/${slug}/sessions/${session.id}`}>
            <Card className="h-full hover:border-primary transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm font-medium">
                    Session {session.sessionNumber}
                    {session.title ? `: ${session.title}` : ''}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs shrink-0 ml-2">
                    <Calendar className="h-3 w-3 mr-1" />
                    {format(new Date(session.date), 'MMM d')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert line-clamp-6 text-sm text-muted-foreground">
                  <ReactMarkdown>
                    {session.aiSummary
                      ? `${session.aiSummary.slice(0, 300)}...`
                      : 'No summary text available.'}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {pending.length > 0 && (
        <div>
          <p className="text-sm text-muted-foreground mb-2">
            Sessions without summaries ({pending.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {pending.map((session) => (
              <Link key={session.id} href={`/campaigns/${slug}/sessions/${session.id}`}>
                <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                  Session {session.sessionNumber}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

