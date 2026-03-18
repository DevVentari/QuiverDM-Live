'use client';

import type { CSSProperties } from 'react';
import { getRarityVars, parseBoldDescription, type Rarity } from '@/lib/homebrew-card-utils';
import { cn } from '@/lib/utils';

export interface MagicItemCardData {
  name: string;
  rarity: Rarity;
  type: string;
  attunement?: boolean;
  attunementNote?: string;
  description: string;
  charges?: {
    max: number;
    current?: number;
    reset: string;
  };
  lore: string;
}

interface MagicItemCardProps {
  item: MagicItemCardData;
}

function BoldText({ text }: { text: string }) {
  const segments = parseBoldDescription(text);
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === 'bold'
          ? <strong key={i} className="font-semibold" style={{ color: 'var(--rc)' }}>{seg.content}</strong>
          : <span key={i}>{seg.content}</span>
      )}
    </>
  );
}

function WondrousIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
      <rect x="1.5" y="3" width="8" height="7" rx="1" stroke="currentColor" strokeWidth="1.1"/>
      <path d="M3.5 3V2.5a2 2 0 0 1 4 0V3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  );
}

function WandIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
      <line x1="2" y1="9" x2="9" y2="2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
      <line x1="7" y1="2" x2="9" y2="2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
      <line x1="9" y1="2" x2="9" y2="4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  );
}

function getTypeIcon(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes('wand') || lower.includes('weapon') || lower.includes('sword')) return <WandIcon />;
  return <WondrousIcon />;
}

const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  'very-rare': 'Very Rare',
  legendary: 'Legendary',
  artifact: 'Artifact',
};

export function MagicItemCard({ item }: MagicItemCardProps) {
  const rarityVars = getRarityVars(item.rarity);
  const currentCharges = item.charges?.current ?? item.charges?.max ?? 0;

  const boxShadow = rarityVars['--rg']
    ? `var(--card-stone-inset), ${rarityVars['--rg']}`
    : 'var(--card-stone-inset), 0 4px 16px hsl(240 10% 4% / 0.4)';

  const cardStyle: CSSProperties = {
    ...(rarityVars as CSSProperties),
    boxShadow,
    borderColor: item.rarity === 'artifact' ? 'hsl(42,60%,28%)' : 'var(--card-stone-border)',
  };

  const attunementLabel = item.attunementNote
    ? `Attunement \u00B7 ${item.attunementNote}`
    : 'Attunement';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[3px] border',
        'bg-[image:var(--card-stone-bg)]',
        'mb-[10px]',
      )}
      style={cardStyle}
    >
      <span
        className="absolute left-0 top-0 bottom-0 w-[3px] opacity-90"
        style={{ background: 'var(--rc)' }}
        aria-hidden
      />

      <div className="px-3 pt-[10px] pb-[10px] pl-4">
        <div className="flex items-start justify-between gap-2 mb-[5px]">
          <span
            className="font-serif text-[14px] font-bold tracking-[.03em] leading-[1.2]"
            style={{ fontFamily: 'var(--font-cinzel, serif)' }}
          >
            {item.name}
          </span>
          <span
            className="flex-shrink-0 text-[9px] font-bold tracking-[.08em] uppercase px-[7px] py-[2px] rounded-full border whitespace-nowrap"
            style={{
              background: 'var(--rb)',
              color: 'var(--rc)',
              borderColor: 'var(--rc)',
            }}
          >
            {RARITY_LABEL[item.rarity]}
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-2 mb-[7px]">
          <span
            className="flex items-center gap-[3px] text-[10px]"
            style={{ color: 'var(--card-text-muted)' }}
          >
            {getTypeIcon(item.type)}
            {item.type}
          </span>
          {item.attunement && (
            <span
              className="text-[9px] font-semibold tracking-[.06em] uppercase px-[6px] py-[1px] rounded-[2px] border"
              style={{
                background: 'hsl(260 30% 12%)',
                color: 'hsl(260,45%,62%)',
                borderColor: 'hsl(260,30%,22%)',
              }}
            >
              {attunementLabel}
            </span>
          )}
        </div>

        <div className="text-[12px] leading-[1.6]">
          <BoldText text={item.description} />
        </div>

        {item.charges && (
          <div className="flex items-center gap-[7px] mt-[7px]">
            <span
              className="text-[9px] uppercase tracking-[.1em] font-semibold"
              style={{ color: 'var(--card-text-muted)' }}
            >
              Charges
            </span>
            <div className="flex gap-[3px]">
              {Array.from({ length: item.charges.max }, (_, i) => (
                <span
                  key={i}
                  className="w-[10px] h-[10px] rounded-full border"
                  style={{
                    background: i < currentCharges ? 'var(--rc)' : 'var(--rb)',
                    borderColor: 'var(--rc)',
                  }}
                />
              ))}
            </div>
            <span
              className="ml-auto text-[9px] italic"
              style={{ color: 'var(--card-text-muted)' }}
            >
              resets {item.charges.reset}
            </span>
          </div>
        )}
      </div>

      <div
        className="px-3 pt-2 pb-[9px] pl-4 border-t"
        style={{ background: 'hsl(240 10% 7%)', borderColor: 'var(--card-stone-border)' }}
      >
        <div
          className="text-[9px] uppercase tracking-[.1em] font-semibold mb-1"
          style={{ color: 'var(--card-text-muted)' }}
        >
          Lore
        </div>
        <p
          className="text-[11px] italic leading-[1.6]"
          style={{ color: 'hsl(35 12% 60%)' }}
        >
          {item.lore}
        </p>
      </div>
    </div>
  );
}
