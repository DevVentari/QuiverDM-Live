'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';

interface NoteNodeData {
  entityId: string;
  label: string;
  type: string;
  onSelect: () => void;
  source?: 'dm' | 'brain';
}

export const NoteNode = memo(function NoteNode({ data, selected }: NodeProps) {
  const d = data as unknown as NoteNodeData;
  const isBrain = d.source === 'brain';
  return (
    <div
      className={cn(
        'max-w-[160px] cursor-pointer rounded border p-2 text-[11px] leading-snug transition-colors',
        isBrain
          ? 'border-[hsl(258_60%_50%/0.4)] bg-[hsl(258_60%_10%/0.7)] text-[hsl(258_80%_85%)]'
          : 'border-[hsl(35_60%_40%/0.4)] bg-[hsl(35_30%_10%/0.7)] text-[hsl(35_60%_85%)]',
        selected && 'ring-1 ring-primary'
      )}
      onClick={d.onSelect}
    >
      {d.label}
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-border !bg-muted" />
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-border !bg-muted" />
    </div>
  );
});
