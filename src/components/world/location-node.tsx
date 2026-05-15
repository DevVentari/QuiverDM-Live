'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ── Type → shape routing ────────────────────────────────────────────────────
type PinShape = 'crest' | 'medallion' | 'teardrop' | 'banner';

const SHAPE_BY_TYPE: Record<string, PinShape> = {
  LOCATION: 'crest',
  CUSTOM:   'crest',
  NPC:      'medallion',
  PC:       'medallion',
  FACTION:  'medallion',
  EVENT:    'teardrop',
  ARC:      'teardrop',
  THREAT:   'teardrop',
  SECRET:   'teardrop',
  NOTE:     'banner',
};

// ── Type → color palette ────────────────────────────────────────────────────
interface PinColors {
  stroke: string;
  glow: string;
  dimStroke: string;
  iconClass: string;
}

const COLORS_BY_TYPE: Record<string, PinColors> = {
  LOCATION: { stroke: 'oklch(0.65 0.16 55)',  glow: 'oklch(0.65 0.16 55 / 0.5)',  dimStroke: 'oklch(0.45 0.10 55)',  iconClass: 'text-amber-500' },
  CUSTOM:   { stroke: 'oklch(0.65 0.16 55)',  glow: 'oklch(0.65 0.16 55 / 0.5)',  dimStroke: 'oklch(0.45 0.10 55)',  iconClass: 'text-amber-500' },
  NPC:      { stroke: 'oklch(0.60 0.18 288)', glow: 'oklch(0.60 0.18 288 / 0.5)', dimStroke: 'oklch(0.42 0.12 288)', iconClass: 'text-violet-400' },
  PC:       { stroke: 'oklch(0.60 0.18 288)', glow: 'oklch(0.60 0.18 288 / 0.5)', dimStroke: 'oklch(0.42 0.12 288)', iconClass: 'text-violet-400' },
  FACTION:  { stroke: 'oklch(0.60 0.18 220)', glow: 'oklch(0.60 0.18 220 / 0.5)', dimStroke: 'oklch(0.42 0.12 220)', iconClass: 'text-sky-400' },
  EVENT:    { stroke: 'oklch(0.62 0.20 28)',  glow: 'oklch(0.62 0.20 28 / 0.5)',  dimStroke: 'oklch(0.44 0.14 28)',  iconClass: 'text-orange-400' },
  ARC:      { stroke: 'oklch(0.62 0.20 28)',  glow: 'oklch(0.62 0.20 28 / 0.5)',  dimStroke: 'oklch(0.44 0.14 28)',  iconClass: 'text-orange-400' },
  THREAT:   { stroke: 'oklch(0.55 0.22 18)',  glow: 'oklch(0.55 0.22 18 / 0.5)',  dimStroke: 'oklch(0.38 0.16 18)',  iconClass: 'text-red-400' },
  SECRET:   { stroke: 'oklch(0.55 0.16 290)', glow: 'oklch(0.55 0.16 290 / 0.4)', dimStroke: 'oklch(0.38 0.10 290)', iconClass: 'text-purple-400' },
  NOTE:     { stroke: 'oklch(0.60 0.08 55)',  glow: 'oklch(0.60 0.08 55 / 0.35)', dimStroke: 'oklch(0.42 0.05 55)',  iconClass: 'text-amber-200/60' },
};

const FALLBACK_COLORS = COLORS_BY_TYPE.LOCATION;

// ── Shared label pill ───────────────────────────────────────────────────────
function LabelPill({ label, stroke, selected }: { label: string; stroke: string; selected: boolean }) {
  return (
    <div
      className="mt-1 max-w-[120px] truncate rounded-md px-2 py-0.5 text-center text-[11px] font-medium backdrop-blur-md"
      style={{
        background: 'oklch(0.13 0.01 260 / 0.92)',
        color: selected ? stroke : 'oklch(0.85 0.02 60)',
        border: `1px solid ${selected ? stroke : 'oklch(1 0 0 / 0.08)'}`,
        boxShadow: '0 2px 8px oklch(0 0 0 / 0.4)',
      }}
    >
      {label}
    </div>
  );
}

// ── Activity dot ────────────────────────────────────────────────────────────
function ActivityDot({ cx, cy, stroke }: { cx: number; cy: number; stroke: string }) {
  return <circle cx={cx} cy={cy} r={5} fill={stroke} stroke="#0f0e1a" strokeWidth={1.5} />;
}

// ── CREST — heraldic shield (LOCATION) ─────────────────────────────────────
function CrestPin({ d, selected, colors }: { d: LocationNodeData; selected: boolean; colors: PinColors }) {
  // 48×60 viewBox, rounded top, pointed bottom
  const shieldPath = 'M 8,0 L 40,0 Q 48,0 48,8 L 48,32 Q 48,50 24,60 Q 0,50 0,32 L 0,8 Q 0,0 8,0 Z';
  const innerPath  = 'M 12,6 L 36,6 Q 42,6 42,12 L 42,30 Q 42,45 24,54 Q 6,45 6,30 L 6,12 Q 6,6 12,6 Z';
  const stroke = selected ? colors.stroke : colors.dimStroke;

  return (
    <div className="flex flex-col items-center">
      <svg
        width={48} height={60} viewBox="0 0 48 60"
        style={{ overflow: 'visible', filter: `drop-shadow(0 5px 14px ${selected ? colors.glow : 'oklch(0 0 0 / 0.4)'})` }}
      >
        <defs>
          <clipPath id={`crest-clip-${d.entityId}`}>
            <path d={shieldPath} />
          </clipPath>
        </defs>
        <path d={shieldPath} fill="#1a1630" stroke={stroke} strokeWidth={2.5} />
        {d.imageUrl ? (
          <image
            href={d.imageUrl}
            x={0} y={0} width={48} height={48}
            clipPath={`url(#crest-clip-${d.entityId})`}
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <text x={24} y={33} textAnchor="middle" fontSize={22} fill={stroke} opacity={0.85}>📍</text>
        )}
        <path d={innerPath} fill="none" stroke={stroke} strokeWidth={1} opacity={0.3} />
        {d.lastEventAt && <ActivityDot cx={40} cy={8} stroke={colors.stroke} />}
      </svg>
      <LabelPill label={d.label} stroke={colors.stroke} selected={selected} />
    </div>
  );
}

// ── MEDALLION — ornate coin (NPC / FACTION) ─────────────────────────────────
function MedallionPin({ d, selected, colors }: { d: LocationNodeData; selected: boolean; colors: PinColors }) {
  const r = 24;
  const stroke = selected ? colors.stroke : colors.dimStroke;
  const ticks = [0, 90, 180, 270].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    const r1 = r + 4, r2 = r + 8;
    return { x1: Math.cos(rad) * r1, y1: Math.sin(rad) * r1, x2: Math.cos(rad) * r2, y2: Math.sin(rad) * r2 };
  });

  return (
    <div className="flex flex-col items-center">
      <svg
        width={68} height={68} viewBox="-34 -34 68 68"
        style={{ overflow: 'visible', filter: `drop-shadow(0 4px 16px ${selected ? colors.glow : 'oklch(0 0 0 / 0.4)'})` }}
      >
        <defs>
          <clipPath id={`med-clip-${d.entityId}`}>
            <circle cx={0} cy={0} r={r - 2} />
          </clipPath>
        </defs>
        <circle cx={0} cy={0} r={r + 8} fill="none" stroke={stroke} strokeWidth={1} opacity={0.2} />
        <circle cx={0} cy={0} r={r + 4} fill="none" stroke={stroke} strokeWidth={1.5} opacity={selected ? 0.55 : 0.35} />
        <circle cx={0} cy={0} r={r} fill="#1a1630" stroke={stroke} strokeWidth={2.5} />
        {d.imageUrl ? (
          <image
            href={d.imageUrl}
            x={-r + 2} y={-r + 2} width={(r - 2) * 2} height={(r - 2) * 2}
            clipPath={`url(#med-clip-${d.entityId})`}
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <text x={0} y={7} textAnchor="middle" fontSize={22} fill={stroke} opacity={0.85}>👤</text>
        )}
        <circle cx={0} cy={0} r={r} fill="none" stroke="white" strokeWidth={0.5} opacity={0.08} />
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={stroke} strokeWidth={1.5} opacity={0.55} />
        ))}
        {d.lastEventAt && <ActivityDot cx={r * 0.68} cy={-r * 0.68} stroke={colors.stroke} />}
      </svg>
      <LabelPill label={d.label} stroke={colors.stroke} selected={selected} />
    </div>
  );
}

// ── TEARDROP — classic map pin (EVENT / ARC / THREAT) ──────────────────────
function TearDropPin({ d, selected, colors }: { d: LocationNodeData; selected: boolean; colors: PinColors }) {
  // 52×80 viewBox, circle head at (26,26) r=22, tapering to point at (26,78)
  const cx = 26, cy = 26, r = 22;
  const path = `M ${cx - r * 0.43},${cy + r * 0.73} Q ${cx - r * 0.8},${cy + r * 1.18} ${cx},78 Q ${cx + r * 0.8},${cy + r * 1.18} ${cx + r * 0.43},${cy + r * 0.73} A ${r},${r} 0 1,0 ${cx - r * 0.43},${cy + r * 0.73} Z`;
  const stroke = selected ? colors.stroke : colors.dimStroke;

  return (
    <div className="flex flex-col items-center">
      <svg
        width={52} height={80} viewBox="0 0 52 80"
        style={{ overflow: 'visible', filter: `drop-shadow(0 5px 14px ${selected ? colors.glow : 'oklch(0 0 0 / 0.4)'})` }}
      >
        <defs>
          <clipPath id={`tear-clip-${d.entityId}`}>
            <circle cx={cx} cy={cy} r={r - 1} />
          </clipPath>
        </defs>
        <path d={path} fill="#1a1630" stroke={stroke} strokeWidth={2.5} />
        {d.imageUrl ? (
          <image
            href={d.imageUrl}
            x={cx - r + 1} y={cy - r + 1} width={(r - 1) * 2} height={(r - 1) * 2}
            clipPath={`url(#tear-clip-${d.entityId})`}
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <text x={cx} y={cy + 7} textAnchor="middle" fontSize={20} fill={stroke} opacity={0.85}>⚔</text>
        )}
        <circle cx={cx} cy={cy} r={r - 1} fill="none" stroke="white" strokeWidth={0.5} opacity={0.08} />
        {d.lastEventAt && <ActivityDot cx={cx + r * 0.65} cy={cy - r * 0.65} stroke={colors.stroke} />}
      </svg>
      <LabelPill label={d.label} stroke={colors.stroke} selected={selected} />
    </div>
  );
}

// ── BANNER — horizontal chip (NOTE) ────────────────────────────────────────
function BannerPin({ d, selected, colors }: { d: LocationNodeData; selected: boolean; colors: PinColors }) {
  const stroke = selected ? colors.stroke : colors.dimStroke;
  return (
    <div className="flex flex-col items-center">
      <div
        className="flex items-center gap-1.5 rounded-full px-2 py-1"
        style={{
          background: '#1a1630',
          border: `2px solid ${stroke}`,
          filter: `drop-shadow(0 3px 10px ${selected ? colors.glow : 'oklch(0 0 0 / 0.35)'})`,
          maxWidth: 140,
        }}
      >
        {d.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={d.imageUrl}
            alt=""
            className="h-5 w-5 shrink-0 rounded-full object-cover"
            style={{ border: `1px solid ${stroke}55` }}
          />
        ) : (
          <span className="shrink-0 text-sm">📝</span>
        )}
        <span
          className="truncate text-[11px] font-semibold"
          style={{ color: selected ? colors.stroke : 'oklch(0.85 0.02 60)', maxWidth: 100 }}
        >
          {d.label}
        </span>
        {d.lastEventAt && (
          <span
            className="ml-0.5 h-2 w-2 shrink-0 rounded-full"
            style={{ background: colors.stroke }}
          />
        )}
      </div>
      {/* anchor pointer */}
      <div
        style={{
          width: 0, height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: `9px solid ${stroke}`,
          marginTop: -1,
          filter: selected ? `drop-shadow(0 2px 4px ${colors.glow})` : undefined,
        }}
      />
    </div>
  );
}

// ── Main node ───────────────────────────────────────────────────────────────
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
  const shape = SHAPE_BY_TYPE[d.type] ?? 'crest';
  const colors = COLORS_BY_TYPE[d.type] ?? FALLBACK_COLORS;

  const pinProps = { d, selected: !!selected, colors };

  return (
    <motion.div
      className={cn('group relative flex flex-col items-center cursor-pointer select-none', d.unplaced && 'opacity-50')}
      onClick={d.onSelect}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: d.unplaced ? 0.5 : 1 }}
      whileHover={{ scale: 1.1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 24 }}
    >
      {shape === 'crest'     && <CrestPin     {...pinProps} />}
      {shape === 'medallion' && <MedallionPin {...pinProps} />}
      {shape === 'teardrop'  && <TearDropPin  {...pinProps} />}
      {shape === 'banner'    && <BannerPin    {...pinProps} />}

      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
      <Handle type="target" position={Position.Top}    className="!opacity-0" />
    </motion.div>
  );
});
