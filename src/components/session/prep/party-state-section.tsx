'use client';

import { useState } from 'react';
import { DndIcon, CLASS_ICONS } from '@/components/ui/dnd-icon';
import type { CharacterNote } from '@/lib/prep-types';

interface CampaignCharacter {
  id: string;
  name: string;
  race?: string | null;
  class?: string | null;
  subclass?: string | null;
  level?: number | null;
  portraitUrl?: string | null;
}

interface PartyStateSectionProps {
  characterNotes: CharacterNote[];
  campaignCharacters: CampaignCharacter[];
  onChange: (notes: CharacterNote[]) => void;
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function classIconName(cls: string | null | undefined) {
  if (!cls) return null;
  const key = Object.keys(CLASS_ICONS).find((k) =>
    cls.toLowerCase().includes(k.toLowerCase())
  );
  return key ? CLASS_ICONS[key] : null;
}

export function PartyStateSection({ characterNotes, campaignCharacters, onChange }: PartyStateSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (characterNotes.length === 0) return null;

  function updateNote(characterId: string, value: string) {
    onChange(characterNotes.map((n) => (n.characterId === characterId ? { ...n, notes: value } : n)));
  }

  return (
    <div
      data-testid="party-strip"
      className="flex items-stretch gap-2 px-3 py-2 overflow-x-auto"
      style={{ borderTop: '1px solid oklch(0.2 0.005 270)' }}
    >
      {characterNotes.map((note) => {
        const char = campaignCharacters.find((c) => c.id === note.characterId);
        const classIcon = classIconName(char?.class);
        const isExpanded = expandedId === note.characterId;

        return (
          <div
            key={note.characterId}
            className="flex-shrink-0 rounded-sm border overflow-hidden"
            style={{
              borderColor: isExpanded ? 'oklch(0.35 0.05 55 / 0.5)' : 'oklch(0.22 0.01 270)',
              background: 'oklch(0.14 0.005 265)',
              width: isExpanded ? '220px' : '100px',
              transition: 'width 200ms ease',
            }}
          >
            <button
              className="flex items-center gap-2 w-full p-2"
              onClick={() => setExpandedId(isExpanded ? null : note.characterId)}
            >
              <div
                className="w-8 h-8 rounded-sm shrink-0 overflow-hidden flex items-center justify-center"
                style={{ background: 'oklch(0.18 0.02 265)', border: '1px solid oklch(0.28 0.01 270)' }}
              >
                {char?.portraitUrl ? (
                  <img src={char.portraitUrl} alt={note.name} className="w-full h-full object-cover object-top" />
                ) : (
                  <span className="font-[family-name:var(--q-font-display)] text-xs font-bold" style={{ color: 'oklch(0.5 0.08 55)' }}>
                    {initials(note.name)}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-1">
                  {classIcon && <DndIcon name={classIcon} className="w-3 h-3 shrink-0 opacity-60" />}
                  <span
                    className="font-[family-name:var(--q-font-display)] text-[11px] font-semibold truncate leading-tight"
                    style={{ color: 'oklch(0.85 0.01 270)' }}
                  >
                    {note.name}
                  </span>
                </div>
                {char?.level && (
                  <p className="text-[9px] leading-tight" style={{ color: 'oklch(0.45 0.01 270)' }}>
                    Lvl {char.level}
                  </p>
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="px-2 pb-2">
                <div className="mx-0 h-px mb-1.5" style={{ background: 'oklch(0.22 0.005 270)' }} />
                <textarea
                  value={note.notes}
                  onChange={(e) => updateNote(note.characterId, e.target.value)}
                  placeholder="Session notes…"
                  rows={3}
                  className="w-full resize-none text-[11px] px-1.5 py-1 outline-none focus:ring-1 ring-amber-500/20 rounded-sm"
                  style={{ background: 'transparent', border: 'none', color: 'oklch(0.7 0.01 270)' }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
