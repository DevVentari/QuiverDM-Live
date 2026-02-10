'use client';

import { Flex, Text } from '@radix-ui/themes'; // Keep Radix Flex and Text for now, will replace later if needed
import Link from 'next/link';
import { DashboardPendingInvite } from '@/types/dashboard';
import { Button } from '@/components/ui/Button'; // Our custom Button

interface ActiveSession {
  campaignName: string;
  campaignSlug: string;
}

interface TodaySession {
  campaignName: string;
  campaignSlug: string;
  time: string;
}

interface ContextBannerProps {
  activeSession?: ActiveSession | null;
  todaySession?: TodaySession | null;
  pendingInvite?: DashboardPendingInvite | null;
  onAcceptInvite?: (inviteId: string) => void;
  onDeclineInvite?: (inviteId: string) => void;
}

export function ContextBanner({
  activeSession,
  todaySession,
  pendingInvite,
  onAcceptInvite,
  onDeclineInvite,
}: ContextBannerProps) {
  // Priority: Active session > Today's session > Pending invite
  if (activeSession) {
    return (
      <div className="bg-cream-white border border-cream-border rounded-md p-4 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎲</span>
            <span className="text-text-primary font-semibold">
              Session Active in {activeSession.campaignName}
            </span>
          </div>
          <Link href={`/campaigns/${activeSession.campaignSlug}`}>
            <Button size="sm">
              Join Session
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (todaySession) {
    return (
      <div className="bg-cream-white border border-cream-border rounded-md p-4 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📅</span>
            <span className="text-text-primary">
              <span className="font-semibold">{todaySession.campaignName}</span>{' '}
              session at {todaySession.time}
            </span>
          </div>
          <Link href={`/campaigns/${todaySession.campaignSlug}`}>
            <Button size="sm" variant="outline">
              View Campaign
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (pendingInvite) {
    return (
      <div className="bg-cream-white border border-cream-border rounded-md p-4 mb-6">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">✉️</span>
            <div>
              <span className="text-text-primary font-semibold block">
                You&apos;ve been invited to {pendingInvite.campaignName}
              </span>
              {pendingInvite.message && (
                <span className="text-text-secondary text-sm">
                  &quot;{pendingInvite.message}&quot;
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDeclineInvite?.(pendingInvite.id)}
            >
              Decline
            </Button>
            <Button
              size="sm"
              onClick={() => onAcceptInvite?.(pendingInvite.id)}
            >
              Accept
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export function ContextBannerSkeleton() {
  return (
    <div className="bg-cream-white border border-cream-border rounded-md p-4 mb-6 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-5 bg-cream-light rounded w-64" />
        <div className="h-8 bg-cream-light rounded w-24" />
      </div>
    </div>
  );
}
