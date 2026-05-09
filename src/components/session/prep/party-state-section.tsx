'use client';

import { Users } from 'lucide-react';
import type { CharacterNote } from '@/lib/prep-types';

interface CampaignCharacter {
  id: string;
  name: string;
  class?: string | null;
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

export function PartyStateSection({ characterNotes, campaignCharacters, onChange }: PartyStateSectionProps) {
  if (characterNotes.length === 0) return null;

  function updateNote(characterId: string, value: string) {
    onChange(characterNotes.map((n) => (n.characterId === characterId ? { ...n, notes: value } : n)));
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-3.5 w-3.5" style={{ color: 'oklch(0.7 0.16 55)' }} />
        <span
          className="font-[family-name:var(--q-font-display)] text-[9px] uppercase tracking-[0.2em]"
          style={{ color: 'oklch(0.7 0.16 55)' }}
        >
          Party State
        </span>
        <div
          className="flex-1 h-px"
          style={{ background: 'linear-gradient(to right, oklch(0.7 0.16 55 / 0.4), transparent)' }}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {characterNotes.map((note) => {
          const char = campaignCharacters.find((c) => c.id === note.characterId);
          const charClass = char?.class ?? null;

          return (
            <div
              key={note.characterId}
              className="flex flex-col rounded-sm border overflow-hidden"
              style={{
                borderColor: 'oklch(0.25 0.01 270)',
                background: 'oklch(0.14 0.005 265)',
              }}
            >
              {/* Portrait area */}
              <div
                className="flex flex-col items-center gap-1.5 pt-4 pb-3 px-3"
                style={{ background: 'oklch(0.12 0.005 265)' }}
              >
                {/* Avatar circle */}
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: 'oklch(0.22 0.06 55)',
                    border: '1.5px solid oklch(0.7 0.16 55 / 0.35)',
                  }}
                >
                  <span
                    className="font-[family-name:var(--q-font-display)] text-sm font-bold"
                    style={{ color: 'oklch(0.8 0.14 55)' }}
                  >
                    {initials(note.name)}
                  </span>
                </div>

                {/* Name */}
                <span
                  className="font-[family-name:var(--q-font-display)] text-[12px] font-semibold text-center leading-tight"
                  style={{ color: 'oklch(0.88 0.01 270)' }}
                >
                  {note.name}
                </span>

                {/* Class */}
                {charClass && (
                  <span
                    className="text-[10px] text-center"
                    style={{ color: 'oklch(0.5 0.01 270)' }}
                  >
                    {charClass}
                  </span>
                )}
              </div>

              {/* Notes textarea */}
              <div className="p-2">
                <textarea
                  value={note.notes}
                  onChange={(e) => updateNote(note.characterId, e.target.value)}
                  placeholder="Session notes…"
                  rows={3}
                  className="w-full resize-none text-[12px] rounded-sm px-2.5 py-2 outline-none focus:ring-1 ring-amber-500/20"
                  style={{
                    background: 'oklch(0.11 0.005 265)',
                    border: '1px solid oklch(0.22 0.01 270)',
                    color: 'oklch(0.75 0.01 270)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
