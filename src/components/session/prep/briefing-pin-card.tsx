'use client';

import { useState } from 'react';
import { Check, X, Pencil, ChevronLeft } from 'lucide-react';
import type { BriefingCard } from '@/lib/briefing-types';

interface BriefingPinCardProps {
  card: BriefingCard;
  onChange: (updated: BriefingCard) => void;
  onClose: () => void;
}

export function BriefingPinCard({ card, onChange, onClose }: BriefingPinCardProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(card.dmNote ?? card.proposal);

  if (card.status === 'accepted' || card.status === 'edited') {
    return (
      <div
        className="rounded-sm border p-3 space-y-2 min-w-[280px] max-w-[360px]"
        style={{ background: 'oklch(0.13 0.008 160)', borderColor: 'oklch(0.45 0.12 145 / 0.5)' }}
      >
        <div className="flex items-center gap-2">
          <Check className="h-3.5 w-3.5 shrink-0" style={{ color: 'oklch(0.65 0.15 145)' }} />
          <span className="text-sm font-semibold flex-1" style={{ color: 'oklch(0.85 0.01 270)' }}>
            {card.entityName}
          </span>
          <button onClick={onClose} style={{ color: 'oklch(0.4 0.01 270)' }}>
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'oklch(0.65 0.01 270)' }}>
          {card.dmNote ?? card.proposal}
        </p>
        <button
          onClick={() => onChange({ ...card, status: 'proposed', dmNote: undefined })}
          className="text-[10px]"
          style={{ color: 'oklch(0.4 0.01 270)' }}
        >
          Undo
        </button>
      </div>
    );
  }

  if (card.status === 'dismissed') {
    return (
      <div
        className="rounded-sm border px-3 py-2 flex items-center gap-2 min-w-[220px] opacity-50"
        style={{ background: 'oklch(0.12 0.005 265)', borderColor: 'oklch(0.2 0.005 270)' }}
      >
        <X className="h-3.5 w-3.5" style={{ color: 'oklch(0.4 0.01 270)' }} />
        <span className="text-xs flex-1" style={{ color: 'oklch(0.45 0.01 270)' }}>
          {card.entityName} — dismissed
        </span>
        <button onClick={() => onChange({ ...card, status: 'proposed' })} className="text-[10px]" style={{ color: 'oklch(0.45 0.01 270)' }}>
          Undo
        </button>
        <button onClick={onClose} style={{ color: 'oklch(0.4 0.01 270)' }}>
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-sm border overflow-hidden min-w-[300px] max-w-[400px]"
      style={{ background: 'oklch(0.14 0.005 265)', borderColor: 'oklch(0.35 0.05 55 / 0.6)' }}
    >
      {/* Header */}
      <div className="px-3 pt-3 pb-1 flex items-center gap-2">
        <span
          className="font-[family-name:var(--q-font-display)] text-sm font-semibold flex-1 truncate"
          style={{ color: 'oklch(0.88 0.01 270)' }}
        >
          {card.entityName}
        </span>
        <button onClick={onClose} style={{ color: 'oklch(0.4 0.01 270)' }}>
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {card.context && (
        <p className="px-3 pb-2 text-[11.5px] leading-relaxed" style={{ color: 'oklch(0.62 0.01 270)' }}>
          {card.context}
        </p>
      )}

      <div className="px-3 pb-1 border-t" style={{ borderColor: 'oklch(0.2 0.005 270)' }}>
        <span
          className="text-[8px] uppercase tracking-[0.2em] font-[family-name:var(--q-font-display)]"
          style={{ color: 'oklch(0.7 0.16 55 / 0.7)' }}
        >
          Brain proposes
        </span>
      </div>

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
                onClick={() => { onChange({ ...card, status: 'accepted' }); onClose(); }}
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
                onClick={() => { onChange({ ...card, status: 'dismissed' }); onClose(); }}
                className="text-[11px] px-2.5 py-1 rounded-sm border font-[family-name:var(--q-font-display)] ml-auto"
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
