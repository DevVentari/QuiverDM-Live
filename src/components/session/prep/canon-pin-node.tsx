'use client';

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { DndIcon } from '@/components/ui/dnd-icon';
import type { DndIconName } from '@/components/ui/dnd-icon';

const TYPE_ICONS: Record<string, DndIconName> = {
  NPC: 'entity/person',
  FACTION: 'entity/organization',
  LOCATION: 'entity/location',
  NOTE: 'util/star',
};

export type CanonPinData = {
  entity: { id: string; name: string; type: string };
};

export const CanonPinNode = memo(function CanonPinNode({ data }: NodeProps) {
  const pinData = data as CanonPinData;
  const iconName = TYPE_ICONS[pinData.entity.type] ?? 'entity/location';

  return (
    <div
      className="flex items-center justify-center w-8 h-8 rounded-full border cursor-default"
      style={{
        background: 'oklch(0.18 0.01 270)',
        borderColor: 'oklch(0.35 0.01 270)',
      }}
      title={pinData.entity.name}
    >
      <DndIcon name={iconName} className="w-4 h-4 opacity-50" />
    </div>
  );
});
