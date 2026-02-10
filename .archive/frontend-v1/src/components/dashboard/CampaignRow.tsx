'use client';

import { Card } from '@/components/ui/Card'; // Our custom Card
import Link from 'next/link';
import { DashboardCampaign, ROLE_BADGES, isDMRole } from '@/types/dashboard';
import { formatRelativeTime, formatSessionTime } from '@/lib/utils/date';

interface CampaignRowProps {
  campaign: DashboardCampaign;
}

export function CampaignRow({ campaign }: CampaignRowProps) {
  const roleBadge = ROLE_BADGES[campaign.role];
  const isDM = isDMRole(campaign.role);

  return (
    <Link href={`/campaigns/${campaign.slug}`}>
      <Card className="bg-cream-white border border-cream-border hover:border-accent-warm transition-all p-4 cursor-pointer group">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            {/* Campaign Name + Role Badge */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-text-primary font-semibold group-hover:text-accent-warm transition-colors truncate">
                {campaign.name}
              </span>
              <span className="inline-flex items-center rounded-full bg-accent-warm/20 px-2.5 py-0.5 text-xs font-medium text-accent-warm flex-shrink-0">
                {roleBadge.emoji} {roleBadge.label}
              </span>
            </div>

            {/* Secondary Info - varies by role */}
            {isDM ? (
              <DMCampaignInfo campaign={campaign} />
            ) : (
              <PlayerCampaignInfo campaign={campaign} />
            )}
          </div>

          {/* Arrow indicator */}
          <div className="text-text-secondary group-hover:text-accent-warm transition-colors flex-shrink-0">
            →
          </div>
        </div>
      </Card>
    </Link>
  );
}

function DMCampaignInfo({ campaign }: { campaign: DashboardCampaign }) {
  return (
    <div className="space-y-1">
      <div className="flex gap-4 text-sm">
        <span className="text-text-secondary">
          📖 {campaign.sessionCount} session{campaign.sessionCount !== 1 ? 's' : ''}
        </span>
        <span className="text-text-secondary">
          👥 {campaign.memberCount} player{campaign.memberCount !== 1 ? 's' : ''}
        </span>
      </div>
      {campaign.lastSessionDate && (
        <p className="text-text-secondary text-xs">
          Last session: {formatRelativeTime(campaign.lastSessionDate)}
        </p>
      )}
    </div>
  );
}

function PlayerCampaignInfo({ campaign }: { campaign: DashboardCampaign }) {
  return (
    <div className="space-y-1">
      {campaign.myCharacter && (
        <p className="text-text-primary text-sm">
          Playing: {campaign.myCharacter.name}
          {campaign.myCharacter.class && (
            <span className="text-accent-warm">
              {' '}({campaign.myCharacter.class} {campaign.myCharacter.level})
            </span>
          )}
        </p>
      )}
      {campaign.nextSession ? (
        <p className="text-text-secondary text-xs">
          Next session: {formatSessionTime(campaign.nextSession.date)}
        </p>
      ) : (
        <p className="text-text-secondary text-xs">
          No upcoming sessions
        </p>
      )}
    </div>
  );
}

export function CampaignRowSkeleton() {
  return (
    <Card className="bg-cream-white border border-cream-border p-4 animate-pulse">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-5 bg-cream-light rounded w-40" />
            <div className="h-5 bg-cream-light rounded w-16" />
          </div>
          <div className="h-4 bg-cream-light rounded w-48" />
          <div className="h-3 bg-cream-light rounded w-32" />
        </div>
        <div className="h-5 bg-cream-light rounded w-4" />
      </div>
    </Card>
  );
}
