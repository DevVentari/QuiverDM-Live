'use client';

import { format } from 'date-fns';
import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import type { RecapStatus, RecapStyle } from '@prisma/client';

const STATUS_LABEL: Partial<Record<RecapStatus, string>> = {
  REVIEWED: 'Reviewed',
  QUICK_FIRE: 'Quick-fire',
  AUTO_GENERATED: 'Pending',
};

const STATUS_DOT_COLOR: Partial<Record<RecapStatus, string>> = {
  REVIEWED: 'hsl(35 60% 50%)',
  QUICK_FIRE: 'hsl(50 80% 50%)',
  AUTO_GENERATED: 'hsl(140 50% 45%)',
};

const STYLE_LABEL: Partial<Record<RecapStyle, string>> = {
  NARRATIVE: 'Narrative',
  SESSION_LOG: 'Session Log',
  BARDS_TALE: "Bard's Tale",
  PREVIOUSLY_ON: 'Previously On',
};

interface SessionListItemProps {
  session: {
    recapId: string;
    sessionId: string;
    sessionTitle: string | null;
    sessionNumber: number | null;
    sessionDate: Date;
    campaignId: string;
    campaignName: string;
    slug: string;
    status: RecapStatus;
    style: RecapStyle | null;
    sharedToDiscord?: boolean;
  };
  showCampaignName?: boolean;
}

export function SessionListItem({ session, showCampaignName }: SessionListItemProps) {
  const title = session.sessionTitle ?? `Session ${session.sessionNumber ?? '?'}`;
  const dotColor = STATUS_DOT_COLOR[session.status];
  const isPending = session.status === 'AUTO_GENERATED';

  return (
    <Link
      href={`/campaigns/${session.slug}/sessions/${session.sessionId}/recap`}
      className="flex items-center gap-3 px-4 py-3 rounded-sm transition-colors hover:bg-[hsl(35_10%_12%_/_0.6)] group"
      style={{
        borderLeft: isPending ? '2px solid hsl(35 60% 42% / 0.4)' : '2px solid transparent',
      }}
    >
      {dotColor && (
        <span
          className="flex-shrink-0 w-2 h-2 rounded-full"
          style={{ background: dotColor }}
          aria-label={STATUS_LABEL[session.status]}
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-medium truncate"
            style={{ fontFamily: 'var(--font-bricolage)', color: 'hsl(35 10% 78%)' }}
          >
            {title}
          </span>
          {showCampaignName && (
            <span
              className="text-[11px] px-1.5 py-0.5 rounded-sm flex-shrink-0"
              style={{
                background: 'hsl(35 10% 14% / 0.8)',
                color: 'hsl(35 5% 42%)',
                fontFamily: 'var(--font-bricolage)',
              }}
            >
              {session.campaignName}
            </span>
          )}
        </div>
        <div
          className="flex items-center gap-1.5 text-[11px] mt-0.5"
          style={{ color: 'hsl(35 5% 38%)', fontFamily: 'var(--font-bricolage)' }}
        >
          <span>{format(session.sessionDate, 'MMM d, yyyy')}</span>
          {session.style && (
            <>
              <span>·</span>
              <span>{STYLE_LABEL[session.style]}</span>
            </>
          )}
          {session.sharedToDiscord && (
            <>
              <span>·</span>
              <MessageSquare className="h-2.5 w-2.5" aria-label="Shared to Discord" />
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {STATUS_LABEL[session.status] && (
          <span
            className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm"
            style={{
              background: isPending ? 'hsl(200 70% 55% / 0.15)' : 'hsl(35 10% 14% / 0.6)',
              color: isPending ? 'hsl(200 70% 65%)' : 'hsl(35 5% 42%)',
            }}
          >
            {STATUS_LABEL[session.status]}
          </span>
        )}
      </div>
    </Link>
  );
}
