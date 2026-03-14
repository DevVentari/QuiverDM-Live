'use client';
import Link from 'next/link';
import { Zap } from 'lucide-react';

interface PlayerCampaignCardProps {
  campaignId: string;
  name: string;
  slug: string;
  bannerUrl: string | null;
  role: string;
  nextSession: { id: string; title: string | null; status: string; date: Date | string | null } | null;
  character: { name: string; class: string | null; level: number } | null;
}

export function PlayerCampaignCard({ name, slug, bannerUrl, role, nextSession, character }: PlayerCampaignCardProps) {
  const isLive = nextSession?.status === 'in_progress';
  return (
    <Link href={`/play/${slug}`} className="group block">
      <div className="stone-card overflow-hidden rounded-lg border border-white/8 hover:border-amber-500/30 transition-colors">
        <div className="relative h-24 bg-gradient-to-br from-indigo-950 to-black">
          {bannerUrl && (
            <img src={bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
          )}
          {isLive && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-600 text-white text-xs font-medium px-2 py-0.5 rounded-full">
              <Zap className="h-3 w-3" />
              LIVE
            </div>
          )}
        </div>
        <div className="p-3">
          <h3 className="font-display text-sm font-semibold text-foreground group-hover:text-amber-400 transition-colors">{name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">{role.toLowerCase().replace('_', ' ')}</p>
          {character && (
            <p className="text-xs text-amber-300/80 mt-0.5">
              {character.name}{character.class ? ` · ${character.class}` : ''} · Lv {character.level}
            </p>
          )}
          {nextSession && !isLive && nextSession.date ? (
            <p className="text-xs text-amber-400/70 mt-1">
              Next: {new Date(nextSession.date).toLocaleDateString()}
            </p>
          ) : !isLive && (
            <p className="text-xs text-muted-foreground/50 mt-1">No upcoming session</p>
          )}
        </div>
      </div>
    </Link>
  );
}
