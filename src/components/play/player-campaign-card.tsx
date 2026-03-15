'use client';
import Link from 'next/link';

const AVATAR_COLORS = [
  'bg-violet-900 text-violet-300',
  'bg-emerald-900 text-emerald-300',
  'bg-rose-900 text-rose-300',
  'bg-sky-900 text-sky-300',
  'bg-amber-900 text-amber-300',
  'bg-fuchsia-900 text-fuchsia-300',
];

function avatarColor(name: string | null) {
  if (!name) return AVATAR_COLORS[0];
  const code = name.charCodeAt(0) + (name.charCodeAt(1) ?? 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

interface PlayerCampaignCardProps {
  campaignId: string;
  name: string;
  slug: string;
  bannerUrl: string | null;
  role: string;
  nextSession: { id: string; title: string | null; status: string; date: Date | string | null } | null;
  character: { name: string; class: string | null; level: number; portraitUrl?: string | null } | null;
  members: { id: string; name: string | null; image: string | null }[];
  memberCount: number;
}

export function PlayerCampaignCard({ name, slug, bannerUrl, role, nextSession, character, members, memberCount }: PlayerCampaignCardProps) {
  const isLive = nextSession?.status === 'in_progress';
  const visibleMembers = members.slice(0, 3);
  const overflow = memberCount - visibleMembers.length;

  return (
    <Link href={`/play/${slug}`} className="group block">
      <div className="stone-card overflow-hidden rounded-lg border border-white/8 hover:border-amber-500/30 transition-colors">
        <div className="relative h-24 bg-gradient-to-br from-indigo-950 to-black">
          {bannerUrl && (
            <img src={bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
          )}
          {isLive ? (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-600 text-white text-xs font-medium px-2 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </div>
          ) : null}
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
          {visibleMembers.length > 0 && (
            <div className="flex items-center gap-0.5 mt-2">
              {visibleMembers.map(m => (
                <div
                  key={m.id}
                  className={`h-5 w-5 rounded-full border border-background/80 overflow-hidden flex items-center justify-center text-[9px] font-bold ${avatarColor(m.name)}`}
                >
                  {m.image
                    ? <img src={m.image} alt={m.name ?? ''} className="h-full w-full object-cover" />
                    : (m.name?.[0] ?? '?')}
                </div>
              ))}
              {overflow > 0 && (
                <span className="text-[10px] text-muted-foreground/60 ml-1">+{overflow}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
