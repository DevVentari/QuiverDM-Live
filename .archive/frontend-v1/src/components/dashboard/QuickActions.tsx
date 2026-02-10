'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button'; // Our custom Button

interface QuickActionsProps {
  hasOwnedCampaigns: boolean;
}

export function QuickActions({ hasOwnedCampaigns }: QuickActionsProps) {
  return (
    <>
      {/* Desktop: Inline section */}
      <div className="hidden md:block">
        <div className="flex gap-3 flex-wrap">
          <Link href="/characters/new">
            <Button variant="outline" size="default">
              <span className="mr-2">🎭</span> Create Character
            </Button>
          </Link>
          <Link href="/join">
            <Button variant="outline" size="default">
              <span className="mr-2">🔗</span> Join Campaign
            </Button>
          </Link>
          <Link href="/campaigns/new">
            <Button variant="outline" size="default">
              <span className="mr-2">🏰</span> Create Campaign
            </Button>
          </Link>
          {hasOwnedCampaigns && (
            <Link href="/homebrew">
              <Button variant="outline" size="default">
                <span className="mr-2">📚</span> Upload PDF
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile: Sticky bottom bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-cream-white border-t border-cream-border p-3 z-50">
        <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
          <Link href="/characters/new">
            <Button variant="outline" size="sm" className="w-full">
              <span className="mr-1">🎭</span> Character
            </Button>
          </Link>
          <Link href="/join">
            <Button variant="outline" size="sm" className="w-full">
              <span className="mr-1">🔗</span> Join
            </Button>
          </Link>
          <Link href="/campaigns/new">
            <Button variant="outline" size="sm" className="w-full">
              <span className="mr-1">🏰</span> Campaign
            </Button>
          </Link>
          {hasOwnedCampaigns ? (
            <Link href="/homebrew">
              <Button variant="outline" size="sm" className="w-full">
                <span className="mr-1">📚</span> PDF
              </Button>
            </Link>
          ) : (
            <div /> // Empty placeholder to maintain grid
          )}
        </div>
      </div>

      {/* Spacer for mobile fixed bar */}
      <div className="md:hidden h-20" />
    </>
  );
}
