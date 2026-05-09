'use client';

import { useState } from 'react';
import { Check, X, Pencil, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { DndIcon } from '@/components/ui/dnd-icon';
import type { DndIconName } from '@/components/ui/dnd-icon';
import type { BriefingCard, BriefingCardType } from '@/lib/briefing-types';

const TYPE_META: Record<BriefingCardType | 'CUSTOM', {
  label: string; color: string; bg: string; border: string; bar: string; icon: DndIconName;
}> = {
  FACTION: {
    label: 'Faction',
    color: 'oklch(0.65 0.2 25)',
    bg: 'oklch(0.65 0.2 25 / 0.1)',
    border: 'oklch(0.65 0.2 25 / 0.4)',
    bar: 'oklch(0.65 0.2 25)',
    icon: 'entity/organization',
  },
  NPC: {
    label: 'NPC',
    color: 'oklch(0.65 0.12 290)',
    bg: 'oklch(0.65 0.12 290 / 0.1)',
    border: 'oklch(0.65 0.12 290 / 0.4)',
    bar: 'oklch(0.6 0.1 200)',
    icon: 'entity/person',
  },
  HOOK: {
    label: 'Hook',
    color: 'oklch(0.7 0.16 55)',
    bg: 'oklch(0.7 0.16 55 / 0.1)',
    border: 'oklch(0.7 0.16 55 / 0.4)',
    bar: 'oklch(0.7 0.16 55)',
    icon: 'game/hazard',
  },
  REGION: {
    label: 'Region',
    color: 'oklch(0.6 0.12 170)',
    bg: 'oklch(0.6 0.12 170 / 0.1)',
    border: 'oklch(0.6 0.12 170 / 0.4)',
    bar: 'oklch(0.6 0.12 170)',
    icon: 'entity/location',
  },
  CUSTOM: {
    label: 'Custom',
    color: 'oklch(0.55 0.01 270)',
    bg: 'oklch(0.55 0.01 270 / 0.1)',
    border: 'oklch(0.55 0.01 270 / 0.4)',
    bar: 'oklch(0.45 0.01 270)',
    icon: 'util/star',
  },
};

function TypeBadge({ meta }: { meta: (typeof TYPE_META)[keyof typeof TYPE_META] }) {
  return (
    <span
      className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm border shrink-0"
      style={{ color: meta.color, borderColor: meta.border, background: meta.bg }}
    >
      <DndIcon name={meta.icon} className="w-3 h-3" style={{ filter: `drop-shadow(0 0 2px ${meta.color})` }} />
      <span className="text-[8px] font-[family-name:var(--q-font-display)] uppercase tracking-wider">
        {meta.label}
      </span>
    </span>
  );
}

function UrgencyPips({ level }: { level: number }) {
  const pipColor = (filled: boolean, lvl: number) => {
    if (!filled) return 'oklch(0.25 0.01 270)';
    if (lvl >= 4) return 'oklch(0.65 0.2 25)';
    if (lvl >= 3) return 'oklch(0.7 0.16 55)';
    return 'oklch(0.6 0.1 200)';
  };

  return (
    <div className="flex gap-[3px] items-center">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="w-[4px] h-[4px] rounded-full"
          style={{ background: pipColor(i < level, level) }}
        />
      ))}
    </div>
  );
}

interface PressureCardProps {
  card: BriefingCard;
  onChange: (updated: BriefingCard) => void;
}

export function PressureCard({ card, onChange }: PressureCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(card.dmNote ?? card.proposal);
  const meta = TYPE_META[card.type] ?? TYPE_META.CUSTOM;

  // Accepted / edited — always compact
  if (card.status === 'accepted' || card.status === 'edited') {
    return (
      <div
        className="rounded-sm border overflow-hidden"
        style={{ borderColor: 'oklch(0.45 0.12 145 / 0.5)', background: 'oklch(0.13 0.008 160)' }}
      >
        <div className="h-[2px]" style={{ background: `linear-gradient(to right, ${meta.bar}, transparent)` }} />
        <div className="px-3 py-2 flex items-center gap-2.5">
          <Check className="h-3 w-3 shrink-0" style={{ color: 'oklch(0.65 0.15 145)' }} />
          <span
            className="font-[family-name:var(--q-font-display)] text-[11.5px] flex-1 min-w-0 truncate"
            style={{ color: 'oklch(0.7 0.01 270)' }}
          >
            {card.entityName}
          </span>
          <TypeBadge meta={meta} />
          {card.status === 'edited' && (
            <span className="text-[9px] uppercase tracking-wider" style={{ color: 'oklch(0.5 0.01 270)' }}>
              edited
            </span>
          )}
          <button
            onClick={() => onChange({ ...card, status: 'proposed', dmNote: undefined })}
            className="text-[10px] shrink-0 ml-1"
            style={{ color: 'oklch(0.4 0.01 270)' }}
          >
            Undo
          </button>
        </div>
      </div>
    );
  }

  // Dismissed — always compact
  if (card.status === 'dismissed') {
    return (
      <div
        className="rounded-sm border px-3 py-2 flex items-center gap-2.5 opacity-40"
        style={{ borderColor: 'oklch(0.2 0.005 270)', background: 'oklch(0.12 0.005 265)' }}
      >
        <X className="h-3 w-3 shrink-0" style={{ color: 'oklch(0.4 0.01 270)' }} />
        <span className="text-[11.5px] flex-1 truncate" style={{ color: 'oklch(0.45 0.01 270)' }}>
          {card.entityName} — dismissed
        </span>
        <button
          onClick={() => onChange({ ...card, status: 'proposed' })}
          className="text-[10px] shrink-0"
          style={{ color: 'oklch(0.45 0.01 270)' }}
        >
          Undo
        </button>
      </div>
    );
  }

  // DM-added — always compact
  if (card.status === 'dm-added') {
    return (
      <div
        className="rounded-sm border overflow-hidden"
        style={{ borderColor: meta.border, background: 'oklch(0.14 0.005 265)' }}
      >
        <div className="h-[2px]" style={{ background: `linear-gradient(to right, ${meta.bar}, transparent)` }} />
        <div className="px-3 py-2 flex items-center gap-2.5">
          <Plus className="h-3 w-3 shrink-0" style={{ color: 'oklch(0.55 0.01 270)' }} />
          <p className="text-[12px] flex-1 truncate" style={{ color: 'oklch(0.72 0.01 270)' }}>{card.proposal}</p>
          <button
            onClick={() => onChange({ ...card, status: 'dismissed' })}
            className="text-[10px] shrink-0"
            style={{ color: 'oklch(0.4 0.01 270)' }}
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  // Proposed — compact header, expands on click
  return (
    <div
      className="rounded-sm border overflow-hidden transition-colors"
      style={{
        borderColor: expanded ? 'oklch(0.35 0.05 55 / 0.6)' : 'oklch(0.25 0.01 270)',
        background: 'oklch(0.14 0.005 265)',
      }}
    >
      <div className="h-[2px]" style={{ background: `linear-gradient(to right, ${meta.bar}, transparent)` }} />

      {/* Header row — always visible */}
      <div className="px-3 pt-2.5 pb-1 flex items-center gap-2">
        <TypeBadge meta={meta} />
        <span
          className="font-[family-name:var(--q-font-display)] text-[12px] font-semibold flex-1 min-w-0 truncate"
          style={{ color: 'oklch(0.88 0.01 270)' }}
        >
          {card.entityName}
        </span>
        <UrgencyPips level={card.urgencyLevel} />
      </div>

      {/* Context — always visible */}
      {card.context && (
        <p className="px-3 pb-2 text-[11.5px] leading-relaxed" style={{ color: 'oklch(0.62 0.01 270)' }}>
          {card.context}
        </p>
      )}

      {/* Brain proposal — toggled by chevron */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-3 py-1.5 flex items-center gap-2"
        style={{ borderTop: '1px solid oklch(0.2 0.005 270)' }}
      >
        <span
          className="text-[8px] uppercase tracking-[0.2em] font-[family-name:var(--q-font-display)] whitespace-nowrap"
          style={{ color: 'oklch(0.7 0.16 55 / 0.7)' }}
        >
          Brain proposes
        </span>
        <div className="flex-1 h-px" style={{ background: 'oklch(0.7 0.16 55 / 0.15)' }} />
        {expanded
          ? <ChevronUp className="h-3 w-3 shrink-0" style={{ color: 'oklch(0.4 0.01 270)' }} />
          : <ChevronDown className="h-3 w-3 shrink-0" style={{ color: 'oklch(0.4 0.01 270)' }} />
        }
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">

          {editing ? (
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
              className="w-full resize-none text-[12.5px] rounded-sm px-3 py-2 outline-none focus:ring-1 ring-amber-500/30"
              style={{
                background: 'oklch(0.11 0.005 265)',
                border: '1px solid oklch(0.35 0.08 55 / 0.5)',
                color: 'oklch(0.78 0.01 270)',
              }}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
          ) : (
            <p
              className="text-[12.5px] leading-relaxed px-3 py-2 rounded-sm border-l-2"
              style={{
                background: 'oklch(0.11 0.005 265)',
                borderColor: 'oklch(0.7 0.16 55 / 0.3)',
                color: 'oklch(0.78 0.01 270)',
              }}
            >
              {card.dmNote ?? card.proposal}
            </p>
          )}

          <div className="flex gap-2 flex-wrap">
            {editing ? (
              <>
                <button
                  onClick={() => { onChange({ ...card, status: 'edited', dmNote: editText }); setEditing(false); }}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-sm border font-[family-name:var(--q-font-display)]"
                  style={{ background: 'oklch(0.45 0.12 145 / 0.15)', borderColor: 'oklch(0.55 0.15 145 / 0.4)', color: 'oklch(0.7 0.15 145)' }}
                >
                  <Check className="h-3 w-3" /> Save
                </button>
                <button
                  onClick={() => { setEditText(card.dmNote ?? card.proposal); setEditing(false); }}
                  className="text-[11px] px-2.5 py-1 rounded-sm border font-[family-name:var(--q-font-display)]"
                  style={{ borderColor: 'oklch(0.3 0.01 270)', color: 'oklch(0.55 0.01 270)' }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { onChange({ ...card, status: 'accepted' }); setExpanded(false); }}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-sm border font-[family-name:var(--q-font-display)]"
                  style={{ background: 'oklch(0.45 0.12 145 / 0.15)', borderColor: 'oklch(0.55 0.15 145 / 0.4)', color: 'oklch(0.7 0.15 145)' }}
                >
                  <Check className="h-3 w-3" /> Use this
                </button>
                <button
                  onClick={() => { setEditText(card.dmNote ?? card.proposal); setEditing(true); }}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-sm border font-[family-name:var(--q-font-display)]"
                  style={{ borderColor: 'oklch(0.3 0.01 270)', color: 'oklch(0.55 0.01 270)' }}
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                <button
                  onClick={() => { onChange({ ...card, status: 'dismissed' }); setExpanded(false); }}
                  className="text-[11px] px-2.5 py-1 rounded-sm border font-[family-name:var(--q-font-display)] ml-auto"
                  style={{ borderColor: 'oklch(0.25 0.01 270)', color: 'oklch(0.4 0.01 270)' }}
                >
                  Dismiss
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
