'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Eye, Sword } from 'lucide-react';

export interface CharacterCardData {
  id: string;
  name: string;
  race?: string | null;
  class?: string | null;
  subclass?: string | null;
  level?: number | null;
  portraitUrl?: string | null;
  dndBeyondId?: string | null;
  armorClass?: number | null;
  speed?: number | null;
  proficiencyBonus?: number | null;
  hitPoints?: { current: number; max: number; temp?: number } | null;
  abilityScores?: { str: number; dex: number; con: number; int: number; wis: number; cha: number } | null;
  campaignCharacters: Array<{ campaign: { id: string; name: string; slug: string } }>;
}

interface CharacterCardProps {
  character: CharacterCardData;
  onQuickView: () => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function hpBarColor(current: number, max: number): string {
  if (max === 0) return 'var(--q-text-faint)';
  const pct = current / max;
  if (pct > 0.6) return 'var(--q-accent-success)';
  if (pct > 0.3) return 'var(--q-accent-quest)';
  return 'var(--q-accent-danger)';
}

export function CharacterCard({ character: char, onQuickView }: CharacterCardProps) {
  const activeCampaign = char.campaignCharacters[0]?.campaign ?? null;
  const hp = char.hitPoints ?? { current: 0, max: 0 };
  const hpPct = hp.max > 0 ? Math.min(100, Math.round((hp.current / hp.max) * 100)) : 0;

  const metaParts = [char.race, char.class, char.subclass].filter(Boolean);

  return (
    <div className="group relative rounded-sm overflow-hidden border border-[var(--q-border-subtle)] bg-[var(--q-surface-raised)] hover:border-[var(--q-amber-dim)] hover:bg-[var(--q-surface-hero)] transition-all duration-150">
      <Link href={`/characters/${char.id}`} className="absolute inset-0 z-0" aria-label={char.name} />

      {/* Portrait area */}
      <div className="relative h-[150px] overflow-hidden bg-[var(--q-surface-sunken)]">
        {char.portraitUrl ? (
          <Image
            src={char.portraitUrl}
            alt={char.name}
            fill
            className="object-cover object-top transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,var(--q-amber-trace),transparent_60%)]">
            <span className="font-[var(--q-font-display)] text-4xl text-[var(--q-amber-dim)]">
              {initials(char.name)}
            </span>
          </div>
        )}

        {/* Bottom gradient fade into card body */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[var(--q-surface-raised)] to-transparent pointer-events-none" />

        {/* Level badge — top left */}
        <div className="absolute top-2 left-2 z-10 bg-black/60 border border-[var(--q-amber-dim)] rounded-sm px-2 py-0.5 font-mono text-[10px] text-[var(--q-amber)] font-bold tracking-wider">
          LVL {char.level ?? '—'}
        </div>

        {/* Status badge — top right */}
        <div className={`absolute top-2 right-2 z-10 rounded-sm px-2 py-0.5 text-[10px] font-semibold tracking-wider border ${
          activeCampaign
            ? 'bg-[var(--q-accent-success-trace)] border-[var(--q-accent-success-border)] text-[var(--q-accent-success)]'
            : 'bg-black/40 border-[var(--q-border-subtle)] text-[var(--q-text-faint)]'
        }`}>
          {activeCampaign ? 'ACTIVE' : 'INACTIVE'}
        </div>

        {/* Eye button — bottom right */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onQuickView(); }}
          className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity rounded-sm border border-[var(--q-amber-dim)] bg-black/60 p-1.5 text-[var(--q-amber)] hover:bg-[var(--q-surface-raised)] focus:opacity-100"
          title="Quick view"
          aria-label={`Quick view ${char.name}`}
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Card body */}
      <div className="px-3 py-3 flex flex-col gap-2">
        <div>
          <p className="font-[var(--q-font-display)] text-sm font-semibold text-[var(--q-amber)] truncate leading-snug">
            {char.name}
          </p>
          <p className="text-[11px] text-[var(--q-text-faint)] uppercase tracking-[1.5px] truncate mt-0.5">
            {metaParts.length > 0 ? metaParts.join(' · ') : 'No details'}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {char.dndBeyondId && (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--q-amber)]" />
              <span className="text-[10px] text-[var(--q-amber-dim)] font-mono font-semibold">DDB</span>
            </>
          )}
          <div className={`flex items-center gap-1 text-[10px] truncate ${char.dndBeyondId ? 'ml-2' : ''} ${activeCampaign ? 'text-[var(--q-amber-dim)]' : 'text-[var(--q-text-faint)]'}`}>
            <Sword className="h-3 w-3 shrink-0" />
            <span className="truncate">{activeCampaign ? activeCampaign.name : 'No campaign'}</span>
          </div>
        </div>

        {/* Stat row */}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="shrink-0 rounded-sm bg-[var(--q-surface-sunken)] border border-[var(--q-border-subtle)] px-2 py-0.5 font-mono text-[11px] text-[var(--q-amber)]">
            AC {char.armorClass ?? '—'}
          </span>
          <span className="shrink-0 rounded-sm bg-[var(--q-surface-sunken)] border border-[var(--q-border-subtle)] px-2 py-0.5 font-mono text-[11px] text-[var(--q-amber)]">
            {hp.current}/{hp.max}
          </span>
          {hp.max > 0 && (
            <div className="flex-1 h-1.5 rounded-full bg-[var(--q-surface-sunken)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${hpPct}%`, backgroundColor: hpBarColor(hp.current, hp.max) }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
