'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LocationNodeData {
  entityId: string;
  label: string;
  type: string;
  lastEventAt?: string | null;
  unplaced?: boolean;
  onSelect: () => void;
}

export const LocationNode = memo(function LocationNode({ data, selected }: NodeProps) {
  const d = data as unknown as LocationNodeData;
  return (
    <motion.div
      className={cn(
        'group relative flex flex-col items-center gap-1 cursor-pointer select-none',
        d.unplaced && 'opacity-60'
      )}
      onClick={d.onSelect}
      whileHover={{ scale: 1.08 }}
    >
      <div className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors',
        selected
          ? 'border-primary bg-primary/20 text-primary'
          : 'border-border bg-card text-muted-foreground group-hover:border-primary group-hover:text-primary'
      )}>
        <MapPin className="h-4 w-4" />
        <AnimatePresence>
          {d.lastEventAt && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary"
            />
          )}
        </AnimatePresence>
      </div>
      <span className="max-w-[100px] truncate rounded bg-card/80 px-1.5 py-0.5 text-center text-[11px] font-medium text-foreground backdrop-blur-sm">
        {d.label}
      </span>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-border !bg-muted" />
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-border !bg-muted" />
    </motion.div>
  );
});
