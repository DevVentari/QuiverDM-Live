'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { MapPin, Users, Shield, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_CONFIG: Record<string, {
  border: string;
  glow: string;
  labelBg: string;
  iconClass: string;
  selectedIconClass: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  LOCATION: {
    border: 'oklch(0.65 0.16 55)',
    glow: 'oklch(0.65 0.16 55 / 0.45)',
    labelBg: 'oklch(0.18 0.01 260 / 0.92)',
    iconClass: 'text-amber-600/70',
    selectedIconClass: 'text-amber-400',
    Icon: MapPin,
  },
  NPC: {
    border: 'oklch(0.60 0.18 288)',
    glow: 'oklch(0.60 0.18 288 / 0.45)',
    labelBg: 'oklch(0.16 0.01 260 / 0.92)',
    iconClass: 'text-violet-500/70',
    selectedIconClass: 'text-violet-400',
    Icon: Users,
  },
  FACTION: {
    border: 'oklch(0.60 0.18 220)',
    glow: 'oklch(0.60 0.18 220 / 0.45)',
    labelBg: 'oklch(0.16 0.01 260 / 0.92)',
    iconClass: 'text-sky-500/70',
    selectedIconClass: 'text-sky-400',
    Icon: Shield,
  },
  NOTE: {
    border: 'oklch(0.55 0.04 260)',
    glow: 'oklch(0.55 0.04 260 / 0.30)',
    labelBg: 'oklch(0.16 0.01 260 / 0.90)',
    iconClass: 'text-slate-400/60',
    selectedIconClass: 'text-slate-300',
    Icon: BookOpen,
  },
};

const FALLBACK = TYPE_CONFIG.LOCATION;

interface LocationNodeData {
  entityId: string;
  label: string;
  type: string;
  imageUrl?: string | null;
  lastEventAt?: string | null;
  unplaced?: boolean;
  onSelect: () => void;
}

export const LocationNode = memo(function LocationNode({ data, selected }: NodeProps) {
  const d = data as unknown as LocationNodeData;
  const cfg = TYPE_CONFIG[d.type] ?? FALLBACK;
  const { Icon } = cfg;
  const hasActivity = !!d.lastEventAt;

  return (
    <motion.div
      className={cn(
        'group relative flex flex-col items-center cursor-pointer select-none',
        d.unplaced && 'opacity-50',
      )}
      onClick={d.onSelect}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: d.unplaced ? 0.5 : 1 }}
      whileHover={{ scale: 1.1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
    >
      {/* Outer glow ring — selected or hover */}
      <div
        className={cn(
          'absolute inset-0 -m-1.5 rounded-full transition-opacity duration-300',
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60',
        )}
        style={{
          boxShadow: `0 0 0 3px ${cfg.glow}, 0 0 18px 6px ${cfg.glow}`,
          borderRadius: '50%',
          top: 0,
          left: 0,
          width: 52,
          height: 52,
        }}
      />

      {/* Activity pulse */}
      {hasActivity && !selected && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 52,
            height: 52,
            border: `2px solid ${cfg.glow}`,
          }}
          animate={{ scale: [1, 1.6, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Pin medallion */}
      <div
        className="relative flex h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-full transition-shadow duration-200"
        style={{
          border: `2.5px solid ${selected ? cfg.border : 'color-mix(in oklab, ' + cfg.border + ' 60%, #1a1828)'}`,
          background: 'linear-gradient(160deg, oklch(0.18 0.01 260), oklch(0.13 0.01 260))',
          boxShadow: selected
            ? `0 4px 24px ${cfg.glow}, inset 0 1px 0 oklch(1 0 0 / 0.08)`
            : `0 2px 10px oklch(0 0 0 / 0.5), inset 0 1px 0 oklch(1 0 0 / 0.06)`,
        }}
      >
        {d.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={d.imageUrl}
            alt={d.label}
            className="h-full w-full object-cover"
            style={{ opacity: selected ? 1 : 0.85 }}
          />
        ) : (
          <Icon className={cn('h-5 w-5', selected ? cfg.selectedIconClass : cfg.iconClass)} />
        )}

        {/* Inner vignette on images */}
        {d.imageUrl && (
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle at center, transparent 50%, oklch(0.1 0.01 260 / 0.55) 100%)',
            }}
          />
        )}

        {/* Activity dot */}
        {hasActivity && (
          <div
            className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border border-[oklch(0.14_0.01_260)]"
            style={{ background: cfg.border }}
          />
        )}
      </div>

      {/* Pin point */}
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: `8px solid ${selected ? cfg.border : 'color-mix(in oklab, ' + cfg.border + ' 55%, #1a1828)'}`,
          marginTop: -1,
          filter: selected ? `drop-shadow(0 2px 4px ${cfg.glow})` : undefined,
          transition: 'border-top-color 200ms',
        }}
      />

      {/* Label */}
      <div
        className="mt-1 max-w-[120px] truncate rounded-md px-2 py-0.5 text-center text-[11px] font-medium leading-tight backdrop-blur-md transition-colors"
        style={{
          background: d.imageUrl
            ? cfg.labelBg
            : `color-mix(in oklab, ${cfg.border} 12%, oklch(0.14 0.01 260 / 0.90))`,
          color: selected
            ? cfg.border
            : 'oklch(0.88 0.02 60)',
          border: `1px solid ${selected ? cfg.border : 'oklch(1 0 0 / 0.07)'}`,
          boxShadow: '0 2px 8px oklch(0 0 0 / 0.4)',
        }}
      >
        {d.label}
      </div>

      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
      <Handle type="target" position={Position.Top} className="!opacity-0" />
    </motion.div>
  );
});
