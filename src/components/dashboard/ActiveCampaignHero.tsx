'use client';

import Image from 'next/image';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DashboardCampaign } from '@/server/services/campaign.service';

export function ActiveCampaignHero({ campaign }: { campaign: DashboardCampaign }) {
  return (
    <div className="relative overflow-hidden rounded-xl border-2">
      {campaign.bannerUrl ? (
        <Image src={campaign.bannerUrl} alt={campaign.name} fill className="object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-950 via-indigo-950 to-blue-950" />
      )}
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative z-10 p-6">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-primary">ACTIVE CAMPAIGN</p>
          <Badge variant="secondary">{campaign.role}</Badge>
        </div>
        <h2 className="mb-1 font-display text-2xl font-bold text-white">{campaign.name}</h2>
        <p className="mb-0.5 text-sm text-white/70">
          Last played:{' '}
          {campaign.lastSessionDate
            ? formatDistanceToNow(new Date(campaign.lastSessionDate), { addSuffix: true })
            : 'No sessions yet'}
          {campaign.nextSession && ` · Next: ${format(new Date(campaign.nextSession.date), 'EEE MMM d, h:mmaaa')}`}
        </p>
        <p className="mb-4 text-sm text-white/60">
          {campaign.sessionCount} sessions · {campaign.memberCount} members
          {campaign.myCharacter && ` · Playing: ${campaign.myCharacter.name}`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/campaigns/${campaign.slug}/sessions`}>Resume →</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/campaigns/${campaign.slug}`}>Session Prep</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/campaigns/${campaign.slug}/members`}>View Party</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
