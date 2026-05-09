'use client';

import { Users } from 'lucide-react';
import { DndIcon } from '@/components/ui/dnd-icon';
import { CLASS_ICONS } from '@/components/ui/dnd-icon';
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
  const key = Object.keys(CLASS_ICONS).find((k) => cls.toLowerCase().includes(k.toLowerCase()));
  return key ? CLASS_ICONS[key] : null;
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {characterNotes.map((note) => {
          const char = campaignCharacters.find((c) => c.id === note.characterId);
          const classIcon = classIconName(char?.class);

          const metaLine = [
            char?.race,
            char?.class && char?.subclass ? `${char.class} · ${char.subclass}` : char?.class,
            char?.level ? `Level ${char.level}` : null,
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <div
              key={note.characterId}
              className="rounded-sm border overflow-hidden"
              style={{
                borderColor: 'oklch(0.25 0.01 270)',
                background: 'oklch(0.14 0.005 265)',
              }}
            >
              {/* Portrait + identity row */}
              <div className="flex items-start gap-3 p-3 pb-2">
                {/* Portrait */}
                <div
                  className="w-14 h-14 rounded-sm shrink-0 overflow-hidden flex items-center justify-center"
                  style={{
                    background: 'oklch(0.18 0.02 265)',
                    border: '1px solid oklch(0.28 0.01 270)',
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
                      className="font-[family-name:var(--q-font-display)] text-base font-bold"
                      style={{ color: 'oklch(0.5 0.08 55)' }}
                    >
                      {initials(note.name)}
                    </span>
                  )}
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-start gap-1.5">
                    {classIcon && (
                      <DndIcon
                        name={classIcon}
                        className="w-4 h-4 shrink-0 mt-0.5 opacity-70"
                      />
                    )}
                    <span
                      className="font-[family-name:var(--q-font-display)] text-[13px] font-semibold leading-tight"
                      style={{ color: 'oklch(0.9 0.01 270)' }}
                    >
                      {note.name}
                    </span>
                  </div>
                  {metaLine && (
                    <p
                      className="text-[10.5px] mt-1 leading-tight"
                      style={{ color: 'oklch(0.5 0.01 270)' }}
                    >
                      {metaLine}
                    </p>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="mx-3 h-px" style={{ background: 'oklch(0.22 0.005 270)' }} />

              {/* Notes textarea */}
              <div className="p-2">
                <textarea
                  value={note.notes}
                  onChange={(e) => updateNote(note.characterId, e.target.value)}
                  placeholder="Session notes…"
                  rows={3}
                  className="w-full resize-none text-[12px] rounded-sm px-2.5 py-1.5 outline-none focus:ring-1 ring-amber-500/20"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'oklch(0.7 0.01 270)',
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
