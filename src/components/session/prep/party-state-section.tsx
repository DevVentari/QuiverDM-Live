'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
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
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function classIconName(cls: string | null | undefined) {
  if (!cls) return null;
  const key = Object.keys(CLASS_ICONS).find((k) =>
    cls.toLowerCase().includes(k.toLowerCase())
  );
  return key ? CLASS_ICONS[key] : null;
}

export function PartyStateSection({
  characterNotes,
  campaignCharacters,
  onChange,
}: PartyStateSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (characterNotes.length === 0) return null;

  function updateNote(characterId: string, value: string) {
    onChange(
      characterNotes.map((n) =>
        n.characterId === characterId ? { ...n, notes: value } : n
      )
    );
  }

  return (
    <div
      data-testid="party-strip"
      className="shrink-0 border-t"
      style={{
        borderColor: 'oklch(0.2 0.005 270)',
        background: 'oklch(0.11 0.005 265 / 0.97)',
      }}
    >
      <div
        className="flex items-center gap-2 px-4 py-1.5 border-b"
        style={{ borderColor: 'oklch(0.18 0.005 270)' }}
      >
        <Users className="h-3 w-3 shrink-0" style={{ color: 'oklch(0.7 0.16 55)' }} />
        <span
          className="font-[family-name:var(--q-font-display)] text-[9px] uppercase tracking-[0.22em]"
          style={{ color: 'oklch(0.7 0.16 55)' }}
        >
          Party State
        </span>
      </div>

      <div className="flex gap-2 px-3 py-2 overflow-x-auto">
        {characterNotes.map((note) => {
          const char = campaignCharacters.find((c) => c.id === note.characterId);
          const classIcon = classIconName(char?.class);
          const isExpanded = expandedId === note.characterId;

          return (
            <div
              key={note.characterId}
              className="shrink-0 rounded-sm border overflow-hidden transition-all duration-200"
              style={{
                borderColor: isExpanded
                  ? 'oklch(0.7 0.16 55 / 0.35)'
                  : 'oklch(0.2 0.005 270)',
                background: 'oklch(0.14 0.005 265)',
                width: isExpanded ? 200 : 72,
              }}
            >
              <button
                className="flex flex-col items-center gap-1 p-2 w-full"
                onClick={() => setExpandedId(isExpanded ? null : note.characterId)}
              >
                <div
                  className="w-9 h-9 rounded-sm overflow-hidden flex items-center justify-center shrink-0"
                  style={{
                    background: 'oklch(0.18 0.02 265)',
                    border: '1px solid oklch(0.24 0.01 270)',
                  }}
                >
                  {char?.portraitUrl ? (
                    <img
                      src={char.portraitUrl}
                      alt={note.name}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <span
                      className="font-[family-name:var(--q-font-display)] text-sm font-bold"
                      style={{ color: 'oklch(0.5 0.08 55)' }}
                    >
                      {initials(note.name)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {classIcon && <DndIcon name={classIcon} className="w-3 h-3 opacity-55" />}
                  <span
                    className="font-[family-name:var(--q-font-display)] text-[10px] font-semibold truncate max-w-[54px]"
                    style={{ color: 'oklch(0.78 0.01 270)' }}
                  >
                    {note.name.split(' ')[0]}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="px-2 pb-2">
                  <div className="h-px mb-1.5" style={{ background: 'oklch(0.2 0.005 270)' }} />
                  <textarea
                    value={note.notes}
                    onChange={(e) => updateNote(note.characterId, e.target.value)}
                    placeholder="Session notes…"
                    rows={3}
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    className="w-full resize-none text-[11px] rounded-sm px-2 py-1 outline-none focus:ring-1 ring-amber-500/20"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'oklch(0.62 0.01 270)',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
