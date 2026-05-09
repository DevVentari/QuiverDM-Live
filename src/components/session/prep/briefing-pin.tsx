'use client';

import React from 'react';
import { type NodeProps, type Node } from '@xyflow/react';
import { DndIcon } from '@/components/ui/dnd-icon';
import type { DndIconName } from '@/components/ui/dnd-icon';
import type { BriefingCardType } from '@/lib/briefing-types';

const TYPE_ICON: Record<BriefingCardType | 'CUSTOM', DndIconName> = {
  FACTION: 'entity/organization',
  NPC: 'entity/person',
  HOOK: 'game/hazard',
  REGION: 'entity/location',
  CUSTOM: 'util/star',
};

const TYPE_COLOR: Record<BriefingCardType | 'CUSTOM', string> = {
  FACTION: 'oklch(0.65 0.2 25)',
  NPC: 'oklch(0.65 0.12 290)',
  HOOK: 'oklch(0.7 0.16 55)',
  REGION: 'oklch(0.6 0.12 170)',
  CUSTOM: 'oklch(0.55 0.01 270)',
};

const AMBER = 'oklch(0.7 0.16 55)';

export type BriefingPinData = {
  cardId: string;
  cardType: BriefingCardType | 'CUSTOM';
  entityName: string;
  placement: 'auto' | 'proposed';
  cardStatus: string;
  isFocused: boolean;
};

export type BriefingPinNode = Node<BriefingPinData, 'briefingPin'>;

const BriefingPinComponent = React.memo(function BriefingPin({
  data,
}: NodeProps<BriefingPinNode>) {
  const icon = TYPE_ICON[data.cardType];
  const typeColor = TYPE_COLOR[data.cardType];
  const isAccepted = data.cardStatus === 'accepted';
  const isDismissed = data.cardStatus === 'dismissed';

  const outer: React.CSSProperties =
    data.placement === 'proposed'
      ? {
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: `2px dashed ${typeColor}`,
          background: typeColor.replace(')', ' / 0.12)').replace('oklch(', 'oklch('),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          opacity: isDismissed ? 0.25 : 1,
          transition: 'opacity 0.3s',
        }
      : {
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: `2px solid ${AMBER}`,
          background: isAccepted ? AMBER : 'oklch(0.14 0.005 265 / 0.9)',
          boxShadow: isAccepted
            ? `0 0 20px ${AMBER}, 0 0 40px ${AMBER}`
            : data.isFocused
            ? `0 0 18px ${AMBER}, 0 0 36px ${AMBER}60, 0 0 0 3px ${AMBER}35`
            : `0 0 10px ${AMBER}80, 0 0 20px ${AMBER}40`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          opacity: isDismissed ? 0.25 : 1,
          transition: 'box-shadow 0.3s, background 0.3s, opacity 0.3s',
        };

  return (
    <div style={outer} title={data.entityName}>
      <DndIcon
        name={icon}
        className="w-3.5 h-3.5"
        style={{
          color: isAccepted ? 'oklch(0.12 0.005 265)' : typeColor,
          filter: `drop-shadow(0 0 2px ${isAccepted ? 'transparent' : typeColor})`,
        }}
      />
    </div>
  );
});
BriefingPinComponent.displayName = 'BriefingPin';

export { BriefingPinComponent };
