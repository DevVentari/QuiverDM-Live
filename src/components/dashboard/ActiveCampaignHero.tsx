'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import type { DashboardCampaign } from '@/server/services/campaign.service';

export function ActiveCampaignHero({ campaign }: { campaign: DashboardCampaign }) {
  return (
    <div className="glass-panel relative overflow-hidden rounded-xl border">
      {campaign.bannerUrl ? (
        <Image src={campaign.bannerUrl} alt={campaign.name} fill className="object-cover" />
      ) : (
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 80% at 70% 50%, hsl(258 40% 10% / 0.8), hsl(240 8% 6%))' }} />
      )}
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative z-10 p-6">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-primary">ACTIVE CAMPAIGN</p>
        </div>
        <h2 className="mb-1 font-display text-2xl font-bold text-white">{campaign.name}</h2>
        <p className="mb-0.5 text-sm text-white/70">
          Last played:{' '}
          {campaign.lastSessionDate
            ? formatDistanceToNow(new Date(campaign.lastSessionDate), { addSuffix: true })
            : 'No sessions yet'}
          {campaign.nextSession && ` | Next: ${format(new Date(campaign.nextSession.date), 'EEE MMM d, h:mmaaa')}`}
        </p>
        <p className="mb-4 text-sm text-white/60">
          {campaign.sessionCount} sessions | {campaign.memberCount} members
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/campaigns/${campaign.slug}/sessions`} className="flex items-center gap-2">Resume <ArrowRight className="h-4 w-4" /></Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/campaigns/${campaign.slug}/sessions/prep`}>Session Prep</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/campaigns/${campaign.slug}/brain`}>Open Brain</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
