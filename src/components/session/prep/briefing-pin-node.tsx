'use client';

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { DndIcon } from '@/components/ui/dnd-icon';
import type { DndIconName } from '@/components/ui/dnd-icon';
import type { BriefingCard } from '@/lib/briefing-types';

const TYPE_ICONS: Record<string, { icon: DndIconName; color: string }> = {
  FACTION: { icon: 'entity/organization', color: 'oklch(0.65 0.2 25)' },
  NPC:     { icon: 'entity/person',       color: 'oklch(0.65 0.12 290)' },
  HOOK:    { icon: 'game/hazard',         color: 'oklch(0.7 0.16 55)' },
  REGION:  { icon: 'entity/location',     color: 'oklch(0.6 0.12 170)' },
  CUSTOM:  { icon: 'util/star',           color: 'oklch(0.55 0.01 270)' },
};

export type BriefingPinData = {
  card: BriefingCard;
  focused: boolean;
  onFocus: (cardId: string) => void;
};

export const BriefingPinNode = memo(function BriefingPinNode({ data }: NodeProps) {
  const { card, focused, onFocus } = data as BriefingPinData;
  const meta = TYPE_ICONS[card.type] ?? TYPE_ICONS.CUSTOM;
  const isProposed = card.mapCoords?.placement === 'proposed';
  const isAccepted = card.status === 'accepted' || card.status === 'edited';

  return (
    <button
      onClick={() => onFocus(card.id)}
      className="relative flex items-center justify-center w-10 h-10 rounded-full"
      style={{
        background: isAccepted
          ? 'oklch(0.7 0.16 55 / 0.9)'
          : isProposed
          ? 'oklch(0.7 0.16 55 / 0.15)'
          : 'oklch(0.2 0.01 270)',
        border: isProposed
          ? '2px dashed oklch(0.7 0.16 55 / 0.6)'
          : focused
          ? '2px solid oklch(0.7 0.16 55)'
          : '2px solid oklch(0.4 0.01 270)',
        boxShadow: !isProposed
          ? `0 0 12px 3px oklch(0.7 0.16 55 / ${focused ? '0.7' : '0.35'}), 0 0 4px oklch(0.7 0.16 55 / 0.5)`
          : 'none',
        animation: isProposed ? 'briefing-pulse 2s ease-in-out infinite' : 'none',
      }}
    >
      <DndIcon
        name={meta.icon}
        className="w-5 h-5"
        style={{ filter: `drop-shadow(0 0 3px ${meta.color})` }}
      />
      <span
        className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full border text-[7px] flex items-center justify-center font-bold"
        style={{
          background: 'oklch(0.12 0.005 265)',
          borderColor: 'oklch(0.7 0.16 55 / 0.5)',
          color: 'oklch(0.7 0.16 55)',
        }}
      >
        {card.urgencyLevel}
      </span>
    </button>
  );
});
