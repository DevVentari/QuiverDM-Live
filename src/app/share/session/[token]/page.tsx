import ReactMarkdown from 'react-markdown';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { Sparkles } from 'lucide-react';
import { prisma } from '@/lib/prisma';

const HIGHLIGHT_COLORS: Record<string, string> = {
  decision: 'bg-blue-100 text-blue-800',
  npc_change: 'bg-purple-100 text-purple-800',
  cliffhanger: 'bg-red-100 text-red-800',
  combat: 'bg-orange-100 text-orange-800',
  loot: 'bg-green-100 text-green-800',
};

type SharedHighlight = {
  type: string;
  text: string;
};

export default async function SharedSessionPage({
  params,
}: {
  params: { token: string };
}) {
  const session = await prisma.gameSession.findUnique({
    where: { shareToken: params.token },
    include: { campaign: { select: { name: true } } },
  });

  if (!session || !session.aiSummary) {
    notFound();
  }

  const highlights = (session.aiHighlights as SharedHighlight[] | null) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{session.campaign.name}</p>
          <h1 className="text-2xl font-bold">
            Session {session.sessionNumber}
            {session.title ? `: ${session.title}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">
            {format(session.date, 'MMMM d, yyyy')}
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          <span>AI-generated summary</span>
        </div>

        <div className="prose max-w-none dark:prose-invert">
          <ReactMarkdown>{session.aiSummary}</ReactMarkdown>
        </div>

        {highlights.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3">Highlights</h2>
            <div className="space-y-2">
              {highlights.map((highlight, index) => (
                <div
                  key={`${highlight.type}-${index}`}
                  className={`rounded-md px-3 py-2 text-sm ${HIGHLIGHT_COLORS[highlight.type] ?? 'bg-muted'}`}
                >
                  <span className="font-medium capitalize">
                    {highlight.type.replace('_', ' ')}:{' '}
                  </span>
                  {highlight.text}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
