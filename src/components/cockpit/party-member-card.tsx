'use client';

import { Heart, Shield, User } from 'lucide-react';

interface HitPoints {
  current: number;
  max: number;
  temp?: number;
}

interface PartyMemberCardProps {
  name: string;
  characterClass?: string | null;
  race?: string | null;
  level?: number | null;
  portraitUrl?: string | null;
  hitPoints?: HitPoints | null;
  armorClass?: number | null;
  conditions?: string[];
}

function getHpState(hp: HitPoints | null | undefined) {
  if (!hp || hp.max === 0) return 'unknown';
  if (hp.current === 0) return 'downed';
  const pct = hp.current / hp.max;
  if (pct <= 0.25) return 'critical';
  if (pct <= 0.5) return 'hurt';
  return 'healthy';
}

const HP_STATE_STYLES = {
  unknown: { bar: 'bg-muted', text: 'text-muted-foreground', ring: '' },
  healthy: { bar: 'bg-emerald-500', text: 'text-foreground', ring: '' },
  hurt: { bar: 'bg-amber-500', text: 'text-amber-400', ring: '' },
  critical: { bar: 'bg-red-500', text: 'text-red-400', ring: 'ring-1 ring-red-500/40' },
  downed: { bar: 'bg-red-700', text: 'text-red-300', ring: 'ring-1 ring-red-700/60 animate-pulse' },
};

export function PartyMemberCard({
  name,
  characterClass,
  race,
  level,
  portraitUrl,
  hitPoints,
  armorClass,
  conditions = [],
}: PartyMemberCardProps) {
  const hpState = getHpState(hitPoints);
  const styles = HP_STATE_STYLES[hpState];
  const hpPct = hitPoints && hitPoints.max > 0
    ? Math.max(0, Math.min(100, (hitPoints.current / hitPoints.max) * 100))
    : 0;

  return (
    <div className={`rounded-md border border-border bg-card/40 p-2.5 space-y-2 ${styles.ring}`}>
      <div className="flex items-center gap-2">
        {/* Portrait */}
        <div className="h-9 w-9 rounded-md overflow-hidden shrink-0 bg-muted flex items-center justify-center">
          {portraitUrl ? (
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={portraitUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <User className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {/* Name + class */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate leading-tight">{name}</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {[characterClass, race, level ? `Lv${level}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>

        {/* AC */}
        {armorClass != null && (
          <div className="flex flex-col items-center shrink-0">
            <Shield className="h-3 w-3 text-sky-400" fill="currentColor" strokeWidth={0} />
            <span className="text-xs font-bold tabular-nums text-sky-400">{armorClass}</span>
          </div>
        )}
      </div>

      {/* HP bar */}
      {hitPoints != null ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Heart className="h-3 w-3 text-red-500" fill="currentColor" strokeWidth={0} />
              <span className={`text-xs font-bold tabular-nums ${styles.text}`}>
                {hitPoints.current}
              </span>
              <span className="text-[10px] text-muted-foreground">/{hitPoints.max}</span>
              {(hitPoints.temp ?? 0) > 0 && (
                <span className="text-[10px] text-blue-400">+{hitPoints.temp}</span>
              )}
            </div>
            {hpState === 'downed' && (
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Down</span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${styles.bar}`}
              style={{ width: `${hpPct}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground italic">HP not tracked</p>
      )}

      {/* Conditions */}
      {conditions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {conditions.map((c) => (
            <span
              key={c}
              className="inline-block rounded px-1.5 py-0.5 text-[9px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
