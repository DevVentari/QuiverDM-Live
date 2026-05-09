'use client';

import { useState } from 'react';
import { Check, X, Pencil, Plus } from 'lucide-react';
import type { BriefingCard, BriefingCardType } from '@/lib/briefing-types';

const TYPE_META: Record<BriefingCardType | 'CUSTOM', { label: string; color: string; bg: string; border: string; bar: string }> = {
  FACTION: {
    label: 'Faction',
    color: 'oklch(0.65 0.2 25)',
    bg: 'oklch(0.65 0.2 25 / 0.08)',
    border: 'oklch(0.65 0.2 25 / 0.4)',
    bar: 'oklch(0.65 0.2 25)',
  },
  NPC: {
    label: 'NPC',
    color: 'oklch(0.65 0.12 290)',
    bg: 'oklch(0.65 0.12 290 / 0.08)',
    border: 'oklch(0.65 0.12 290 / 0.4)',
    bar: 'oklch(0.6 0.1 200)',
  },
  HOOK: {
    label: 'Hook',
    color: 'oklch(0.7 0.16 55)',
    bg: 'oklch(0.7 0.16 55 / 0.08)',
    border: 'oklch(0.7 0.16 55 / 0.4)',
    bar: 'oklch(0.7 0.16 55)',
  },
  REGION: {
    label: 'Region',
    color: 'oklch(0.6 0.12 170)',
    bg: 'oklch(0.6 0.12 170 / 0.08)',
    border: 'oklch(0.6 0.12 170 / 0.4)',
    bar: 'oklch(0.6 0.12 170)',
  },
  CUSTOM: {
    label: 'Custom',
    color: 'oklch(0.55 0.01 270)',
    bg: 'oklch(0.55 0.01 270 / 0.08)',
    border: 'oklch(0.55 0.01 270 / 0.4)',
    bar: 'oklch(0.45 0.01 270)',
  },
};

function UrgencyPips({ level }: { level: number }) {
  const pipColor = (filled: boolean, level: number) => {
    if (!filled) return 'oklch(0.25 0.01 270)';
    if (level >= 4) return 'oklch(0.65 0.2 25)';
    if (level >= 3) return 'oklch(0.7 0.16 55)';
    return 'oklch(0.6 0.1 200)';
  };

  return (
    <div className="flex gap-[3px] items-center">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="w-[5px] h-[5px] rounded-full"
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
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(card.dmNote ?? card.proposal);
  const meta = TYPE_META[card.type] ?? TYPE_META.CUSTOM;

  if (card.status === 'accepted' || card.status === 'edited') {
    return (
      <div
        className="rounded-sm border overflow-hidden"
        style={{ borderColor: 'oklch(0.45 0.12 145 / 0.5)', background: 'oklch(0.13 0.008 160)' }}
      >
        <div className="h-[2px]" style={{ background: `linear-gradient(to right, ${meta.bar}, transparent)` }} />
        <div className="px-4 py-2.5 flex items-center gap-3">
          <Check className="h-3.5 w-3.5 shrink-0" style={{ color: 'oklch(0.65 0.15 145)' }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="font-[family-name:var(--q-font-display)] text-xs"
                style={{ color: 'oklch(0.7 0.01 270)' }}
              >
                {card.entityName}
              </span>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-sm border font-[family-name:var(--q-font-display)] uppercase tracking-wider"
                style={{ color: meta.color, borderColor: meta.border, background: meta.bg }}
              >
                {meta.label}
              </span>
              {card.status === 'edited' && (
                <span className="text-[9px] uppercase tracking-wider" style={{ color: 'oklch(0.5 0.01 270)' }}>
                  edited
                </span>
              )}
            </div>
            <p className="text-[11px] mt-0.5 truncate" style={{ color: 'oklch(0.5 0.01 270)' }}>
              {card.dmNote ?? card.proposal}
            </p>
          </div>
          <button
            onClick={() => onChange({ ...card, status: 'proposed', dmNote: undefined })}
            className="text-[10px] shrink-0"
            style={{ color: 'oklch(0.4 0.01 270)' }}
          >
            Undo
          </button>
        </div>
      </div>
    );
  }

  if (card.status === 'dismissed') {
    return (
      <div
        className="rounded-sm border px-4 py-2 flex items-center gap-3 opacity-40"
        style={{ borderColor: 'oklch(0.2 0.005 270)', background: 'oklch(0.12 0.005 265)' }}
      >
        <X className="h-3 w-3 shrink-0" style={{ color: 'oklch(0.4 0.01 270)' }} />
        <span className="text-xs flex-1 truncate" style={{ color: 'oklch(0.45 0.01 270)' }}>
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

  if (card.status === 'dm-added') {
    return (
      <div
        className="rounded-sm border overflow-hidden"
        style={{ borderColor: meta.border, background: 'oklch(0.14 0.005 265)' }}
      >
        <div className="h-[2px]" style={{ background: `linear-gradient(to right, ${meta.bar}, transparent)` }} />
        <div className="px-4 py-2.5 flex items-center gap-3">
          <Plus className="h-3.5 w-3.5 shrink-0" style={{ color: 'oklch(0.55 0.01 270)' }} />
          <p className="text-[12.5px] flex-1" style={{ color: 'oklch(0.72 0.01 270)' }}>{card.proposal}</p>
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

  // proposed state
  return (
    <div
      className="rounded-sm border overflow-hidden"
      style={{ borderColor: 'oklch(0.25 0.01 270)', background: 'oklch(0.14 0.005 265)' }}
    >
      <div className="h-[2px]" style={{ background: `linear-gradient(to right, ${meta.bar}, transparent)` }} />
      <div className="px-4 py-3.5">
        <div className="flex items-center gap-2 mb-2.5">
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-sm border font-[family-name:var(--q-font-display)] uppercase tracking-wider shrink-0"
            style={{ color: meta.color, borderColor: meta.border, background: meta.bg }}
          >
            {meta.label}
          </span>
          <span
            className="font-[family-name:var(--q-font-display)] text-[13px] font-semibold flex-1 min-w-0 truncate"
            style={{ color: 'oklch(0.88 0.01 270)' }}
          >
            {card.entityName}
          </span>
          <UrgencyPips level={card.urgencyLevel} />
        </div>

        {card.context && (
          <p className="text-[12.5px] mb-3 leading-relaxed" style={{ color: 'oklch(0.65 0.01 270)' }}>
            {card.context}
          </p>
        )}

        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[8.5px] uppercase tracking-[0.2em] font-[family-name:var(--q-font-display)] whitespace-nowrap"
            style={{ color: 'oklch(0.7 0.16 55 / 0.7)' }}
          >
            Brain proposes
          </span>
          <div className="flex-1 h-px" style={{ background: 'oklch(0.7 0.16 55 / 0.2)' }} />
        </div>

        {editing ? (
          <div className="mb-3">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
              className="w-full resize-none text-[13px] rounded-sm px-3 py-2 outline-none focus:ring-1 ring-amber-500/30"
              style={{
                background: 'oklch(0.11 0.005 265)',
                border: '1px solid oklch(0.35 0.08 55 / 0.5)',
                color: 'oklch(0.78 0.01 270)',
              }}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
          </div>
        ) : (
          <p
            className="text-[13px] mb-3 leading-relaxed px-3 py-2 rounded-sm border-l-2"
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
                onClick={() => {
                  onChange({ ...card, status: 'edited', dmNote: editText });
                  setEditing(false);
                }}
                className="flex items-center gap-1 text-[11.5px] px-3 py-1 rounded-sm border font-[family-name:var(--q-font-display)]"
                style={{
                  background: 'oklch(0.45 0.12 145 / 0.15)',
                  borderColor: 'oklch(0.55 0.15 145 / 0.4)',
                  color: 'oklch(0.7 0.15 145)',
                }}
              >
                <Check className="h-3 w-3" /> Save
              </button>
              <button
                onClick={() => {
                  setEditText(card.dmNote ?? card.proposal);
                  setEditing(false);
                }}
                className="text-[11.5px] px-3 py-1 rounded-sm border font-[family-name:var(--q-font-display)]"
                style={{ borderColor: 'oklch(0.3 0.01 270)', color: 'oklch(0.55 0.01 270)' }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onChange({ ...card, status: 'accepted' })}
                className="flex items-center gap-1 text-[11.5px] px-3 py-1 rounded-sm border font-[family-name:var(--q-font-display)]"
                style={{
                  background: 'oklch(0.45 0.12 145 / 0.15)',
                  borderColor: 'oklch(0.55 0.15 145 / 0.4)',
                  color: 'oklch(0.7 0.15 145)',
                }}
              >
                <Check className="h-3 w-3" /> Use this
              </button>
              <button
                onClick={() => {
                  setEditText(card.dmNote ?? card.proposal);
                  setEditing(true);
                }}
                className="flex items-center gap-1 text-[11.5px] px-3 py-1 rounded-sm border font-[family-name:var(--q-font-display)]"
                style={{ borderColor: 'oklch(0.3 0.01 270)', color: 'oklch(0.55 0.01 270)' }}
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
              <button
                onClick={() => onChange({ ...card, status: 'dismissed' })}
                className="text-[11.5px] px-3 py-1 rounded-sm border font-[family-name:var(--q-font-display)] ml-auto"
                style={{ borderColor: 'oklch(0.25 0.01 270)', color: 'oklch(0.4 0.01 270)' }}
              >
                Dismiss
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
