'use client';

import { useId } from 'react';

export type LogoVariant = 'standard' | 'arcane' | 'legendary' | 'gilded';

interface QuiverLogoProps {
  variant: LogoVariant;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  sm: { w: 26, h: 32 },
  md: { w: 28, h: 34 },
  lg: { w: 52, h: 64 },
};

function StandardIcon() {
  return (
    <>
      <path
        d="M36,4 L60,15 L60,39 Q60,57 36,70 Q12,57 12,39 L12,15 Z"
        fill="hsl(240,10%,11%)"
        stroke="hsl(35,80%,48%)"
        strokeWidth="1.8"
      />
      <path
        d="M36,9 L55,18 L55,39 Q55,54 36,65 Q17,54 17,39 L17,18 Z"
        fill="none"
        stroke="hsl(35,35%,22%)"
        strokeWidth="0.7"
      />
      <rect x="29" y="24" width="14" height="26" rx="7"
        fill="hsl(240,10%,8%)" stroke="hsl(35,60%,50%)" strokeWidth="1.3" />
      <circle cx="36" cy="46" r="4.5"
        fill="hsl(260,55%,32%)" stroke="hsl(260,60%,62%)" strokeWidth="1.2" />
      <line x1="33" y1="23" x2="33" y2="15" stroke="hsl(35,80%,62%)" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="36" y1="23" x2="36" y2="12" stroke="hsl(35,80%,62%)" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="39" y1="23" x2="39" y2="16" stroke="hsl(35,80%,62%)" strokeWidth="1.4" strokeLinecap="round" />
      <polygon points="33,15 31.5,19 34.5,19" fill="hsl(35,80%,52%)" />
      <polygon points="36,12 34.5,16 37.5,16" fill="hsl(35,80%,52%)" />
      <polygon points="39,16 37.5,20 40.5,20" fill="hsl(35,80%,52%)" />
    </>
  );
}

function ArcaneIcon() {
  return (
    <>
      <path d="M36,4 L60,15 L60,39 Q60,57 36,70 Q12,57 12,39 L12,15 Z"
        fill="hsl(240,10%,11%)" stroke="hsl(35,80%,48%)" strokeWidth="1.8" />
      <path d="M36,9 L55,18 L55,39 Q55,54 36,65 Q17,54 17,39 L17,18 Z"
        fill="none" stroke="hsl(35,35%,22%)" strokeWidth="0.7" />
      <rect x="29" y="24" width="14" height="26" rx="7"
        fill="hsl(260,45%,22%)" stroke="hsl(260,50%,58%)" strokeWidth="1.4" />
      <circle cx="36" cy="40" r="3.5"
        fill="none" stroke="hsl(260,50%,55%)" strokeWidth="0.8" opacity="0.7" />
      <line x1="33" y1="23" x2="33" y2="15" stroke="hsl(35,80%,62%)" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="36" y1="23" x2="36" y2="12" stroke="hsl(35,80%,62%)" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="39" y1="23" x2="39" y2="16" stroke="hsl(35,80%,62%)" strokeWidth="1.4" strokeLinecap="round" />
      <polygon points="33,15 31.5,19 34.5,19" fill="hsl(35,80%,52%)" />
      <polygon points="36,12 34.5,16 37.5,16" fill="hsl(35,80%,52%)" />
      <polygon points="39,16 37.5,20 40.5,20" fill="hsl(35,80%,52%)" />
    </>
  );
}

function LegendaryIcon({ clipId }: { clipId: string }) {
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <path d="M36,4 L60,15 L60,39 Q60,57 36,70 Q12,57 12,39 L12,15 Z" />
        </clipPath>
      </defs>
      <path d="M36,4 L60,15 L60,39 Q60,57 36,70 Q12,57 12,39 L12,15 Z"
        fill="hsl(240,10%,11%)" stroke="hsl(35,80%,48%)" strokeWidth="1.8" />
      <rect x="12" y="33" width="48" height="13"
        fill="hsl(260,40%,25%)" opacity="0.45" clipPath={`url(#${clipId})`} />
      <path d="M36,9 L55,18 L55,39 Q55,54 36,65 Q17,54 17,39 L17,18 Z"
        fill="none" stroke="hsl(35,35%,22%)" strokeWidth="0.7" />
      <rect x="29" y="24" width="14" height="26" rx="7"
        fill="hsl(240,10%,8%)" stroke="hsl(35,60%,50%)" strokeWidth="1.3" />
      <line x1="33" y1="23" x2="33" y2="15" stroke="hsl(35,80%,62%)" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="36" y1="23" x2="36" y2="12" stroke="hsl(35,80%,62%)" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="39" y1="23" x2="39" y2="16" stroke="hsl(35,80%,62%)" strokeWidth="1.4" strokeLinecap="round" />
      <polygon points="33,15 31.5,19 34.5,19" fill="hsl(35,80%,62%)" />
      <polygon points="36,12 34.5,16 37.5,16" fill="hsl(35,80%,62%)" />
      <polygon points="39,16 37.5,20 40.5,20" fill="hsl(35,80%,62%)" />
    </>
  );
}

function GildedIcon() {
  return (
    <>
      <path d="M50,8 L76,20 L76,48 Q76,68 50,82 Q24,68 24,48 L24,20 Z"
        fill="hsl(40,60%,14%)" stroke="hsl(40,80%,55%)" strokeWidth="2.2" />
      <path d="M50,13 L71,23 L71,48 Q71,64 50,76 Q29,64 29,48 L29,23 Z"
        fill="none" stroke="hsl(40,70%,40%)" strokeWidth="1" />
      <circle cx="50" cy="13" r="2" fill="hsl(40,80%,55%)" />
      <rect x="43" y="30" width="14" height="30" rx="7"
        fill="hsl(40,50%,16%)" stroke="hsl(40,80%,58%)" strokeWidth="1.5" />
      <line x1="46" y1="29" x2="46" y2="19" stroke="hsl(40,90%,68%)" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="50" y1="29" x2="50" y2="16" stroke="hsl(40,90%,68%)" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="54" y1="29" x2="54" y2="20" stroke="hsl(40,90%,68%)" strokeWidth="1.8" strokeLinecap="round" />
      <polygon points="46,19 44,24 48,24" fill="hsl(40,90%,62%)" />
      <polygon points="50,16 48,21 52,21" fill="hsl(40,90%,62%)" />
      <polygon points="54,20 52,25 56,25" fill="hsl(40,90%,62%)" />
    </>
  );
}

export function QuiverLogo({ variant, size = 'md', className }: QuiverLogoProps) {
  const { w, h } = SIZE_MAP[size];
  const clipId = useId().replace(/:/g, '');
  const isGilded = variant === 'gilded';

  return (
    <svg
      width={w}
      height={h}
      viewBox={isGilded ? '0 0 100 120' : '0 0 72 88'}
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {variant === 'standard' && <StandardIcon />}
      {variant === 'arcane' && <ArcaneIcon />}
      {variant === 'legendary' && <LegendaryIcon clipId={`legendary-${clipId}`} />}
      {variant === 'gilded' && <GildedIcon />}
    </svg>
  );
}
