'use client';

import { Users } from 'lucide-react';
import { StepCharacters } from './steps/step-characters';
import type { CharacterNote } from '@/lib/prep-types';

interface PartyStateSectionProps {
  characterNotes: CharacterNote[];
  onChange: (notes: CharacterNote[]) => void;
}

export function PartyStateSection({ characterNotes, onChange }: PartyStateSectionProps) {
  if (characterNotes.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
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
      <StepCharacters characterNotes={characterNotes} onChange={onChange} />
    </div>
  );
}
