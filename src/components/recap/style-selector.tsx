'use client';

import type { RecapStyle, RecapStatus } from '@prisma/client';

const STYLE_LABELS: Record<RecapStyle, string> = {
  NARRATIVE: 'Narrative',
  SESSION_LOG: 'Session Log',
  BARDS_TALE: "Bard's Tale",
  PREVIOUSLY_ON: 'Previously On',
};

const STYLE_ACCENTS: Record<RecapStyle, string> = {
  NARRATIVE: 'hsl(35 80% 55%)',
  SESSION_LOG: 'hsl(200 60% 50%)',
  BARDS_TALE: 'hsl(280 50% 55%)',
  PREVIOUSLY_ON: 'hsl(150 50% 45%)',
};

const STATUS_DOT: Partial<Record<RecapStatus, string>> = {
  QUICK_FIRE: 'bg-yellow-400/70',
  REVIEWED: 'bg-amber-500/60',
  AUTO_GENERATED: 'bg-green-500/60',
};

const STYLES: RecapStyle[] = ['NARRATIVE', 'SESSION_LOG', 'BARDS_TALE', 'PREVIOUSLY_ON'];

interface StyleSelectorProps {
  activeStyle: RecapStyle;
  onChange: (style: RecapStyle) => void;
  disabled?: boolean;
  bestStatus?: Partial<Record<RecapStyle, RecapStatus>>;
}

export function StyleSelector({ activeStyle, onChange, disabled, bestStatus }: StyleSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {STYLES.map((style) => {
        const isActive = style === activeStyle;
        const accent = STYLE_ACCENTS[style];
        const dotStatus = bestStatus?.[style];
        const dotClass = dotStatus ? STATUS_DOT[dotStatus] : null;

        return (
          <button
            key={style}
            onClick={() => !disabled && onChange(style)}
            disabled={disabled}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs transition-all"
            style={{
              borderLeft: `3px solid ${accent}`,
              background: isActive ? `${accent}22` : 'hsl(35 10% 12% / 0.6)',
              color: isActive ? accent : 'hsl(35 5% 48%)',
              border: isActive ? `1px solid ${accent}40` : '1px solid hsl(35 10% 18% / 0.5)',
              borderLeftColor: accent,
              borderLeftWidth: '3px',
              fontFamily: 'var(--font-bricolage)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {dotClass && (
              <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`} />
            )}
            {STYLE_LABELS[style]}
          </button>
        );
      })}
    </div>
  );
}
