'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

const mono = 'font-[family-name:var(--qd-font-mono)]';

export interface TokenNodeData {
  label: string;
  type: 'pc' | 'npc' | 'monster';
  hpPct: number;
  isTurn: boolean;
  isSelected: boolean;
  isDead: boolean;
  onSelect: () => void;
  [key: string]: unknown;
}

const STYLE: Record<TokenNodeData['type'], { ring: string; text: string; fillFrom: string; barFrom: string; barTo: string }> = {
  pc:      { ring: 'var(--qd-success)', text: 'var(--qd-success-hi)', fillFrom: 'rgba(127,174,90,.28)', barFrom: '#5f8f45', barTo: '#8fc466' },
  npc:     { ring: 'var(--qd-accent)',  text: 'var(--qd-accent-text)', fillFrom: 'rgba(217,138,61,.30)', barFrom: '#b8453a', barTo: '#e0944a' },
  monster: { ring: 'var(--qd-danger)',  text: 'var(--qd-danger-hi)', fillFrom: 'rgba(196,69,58,.30)', barFrom: '#8a2f26', barTo: '#c4453a' },
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

function TokenNodeImpl({ data }: NodeProps) {
  const d = data as TokenNodeData;
  const s = STYLE[d.type] ?? STYLE.npc;
  return (
    <button
      type="button"
      onClick={d.onSelect}
      className="-translate-x-1/2 -translate-y-1/2 text-center"
      style={{ opacity: d.isDead ? 0.45 : 1 }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <span className="relative mx-auto flex h-[52px] w-[52px] items-center justify-center">
        {d.isTurn && (
          <span className="absolute rounded-full border-2 border-dashed" style={{ inset: -6, borderColor: 'rgba(217,138,61,.85)' }} />
        )}
        <span
          className="grid h-[46px] w-[46px] place-items-center rounded-full border-2 text-[18px] font-bold"
          style={{
            borderColor: d.isSelected ? 'var(--qd-accent-hi)' : s.ring,
            background: `radial-gradient(circle, ${s.fillFrom}, rgba(0,0,0,.35))`,
            color: s.text,
            boxShadow: d.isTurn ? '0 0 22px rgba(217,138,61,.55)' : '0 4px 14px rgba(0,0,0,.5)',
          }}
        >
          {initials(d.label)}
        </span>
      </span>
      <span className="mx-auto mt-1.5 block h-[4px] w-[40px] overflow-hidden rounded-[3px] bg-[rgba(0,0,0,0.55)]">
        <span className="block h-full" style={{ width: `${d.hpPct}%`, background: `linear-gradient(90deg, ${s.barFrom}, ${s.barTo})` }} />
      </span>
      <span className={`${mono} mt-1 block whitespace-nowrap text-[8px]`} style={{ color: s.text, textShadow: '0 1px 4px #000' }}>
        {d.isTurn ? '▸ ' : ''}{d.label}
      </span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </button>
  );
}

export const TokenNode = memo(TokenNodeImpl);
