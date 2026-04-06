'use client';

import { formatDistanceToNow } from 'date-fns';
import { PendingBadge } from './pending-badge';

interface CampaignCardProps {
  campaign: {
    id: string;
    name: string;
    slug: string;
    totalRecaps: number;
    pendingReview: number;
    lastRecapDate: Date | null;
    lastSessionTitle: string | null;
  };
  isActive: boolean;
  onClick: () => void;
}

export function CampaignCard({ campaign, isActive, onClick }: CampaignCardProps) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-sm p-4 transition-all min-w-[280px] max-w-[360px] w-full flex flex-col gap-2"
      style={{
        background: isActive ? 'hsl(35 20% 12% / 0.9)' : 'hsl(35 10% 10% / 0.7)',
        border: isActive
          ? '1px solid hsl(35 60% 38% / 0.6)'
          : '1px solid hsl(35 10% 18% / 0.4)',
        boxShadow: isActive ? '0 0 0 1px hsl(35 60% 38% / 0.2)' : 'none',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          className="text-[11px] font-bold uppercase tracking-[0.1em] leading-tight"
          style={{ fontFamily: 'var(--font-cinzel)', color: 'hsl(35 60% 62%)' }}
        >
          {campaign.name}
        </h3>
        <PendingBadge count={campaign.pendingReview} />
      </div>

      <div
        className="flex items-center gap-2 text-[11px]"
        style={{ color: 'hsl(35 5% 38%)' }}
      >
        <span style={{ fontFamily: 'var(--font-mono)' }}>{campaign.totalRecaps}</span>
        <span>sessions</span>
        {campaign.lastRecapDate && (
          <>
            <span>·</span>
            <span>{formatDistanceToNow(campaign.lastRecapDate, { addSuffix: true })}</span>
          </>
        )}
      </div>

      {campaign.lastSessionTitle && (
        <p
          className="text-[12px] italic line-clamp-2"
          style={{ color: 'hsl(35 5% 42%)', fontFamily: 'var(--font-bricolage)' }}
        >
          {campaign.lastSessionTitle}
        </p>
      )}

      {!campaign.lastSessionTitle && campaign.totalRecaps === 0 && (
        <p className="text-[11px] italic" style={{ color: 'hsl(35 5% 32%)' }}>
          No sessions yet
        </p>
      )}
    </button>
  );
}
