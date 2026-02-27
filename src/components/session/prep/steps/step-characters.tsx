'use client';

import { Users } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CharacterNote } from '@/lib/prep-types';

export function StepCharacters({
  characterNotes,
  onChange,
}: {
  characterNotes: CharacterNote[];
  onChange: (notes: CharacterNote[]) => void;
}) {
  const updateNote = (
    index: number,
    field: keyof CharacterNote,
    value: string
  ) => {
    const next = characterNotes.map((note, i) =>
      i === index ? { ...note, [field]: value } : note
    );
    onChange(next);
  };

  if (characterNotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Users className="mb-3 h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">
          No characters in this campaign
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Add player characters first from the Characters page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {characterNotes.map((character, i) => (
        <div
          key={character.characterId}
          className="space-y-3 rounded-xl border border-border bg-card/50 p-4"
        >
          <h3 className="text-sm font-semibold text-foreground">{character.name}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Goals and Motivations
              </Label>
              <Textarea
                value={character.goals}
                onChange={(e) => updateNote(i, 'goals', e.target.value)}
                placeholder="What does this character want right now?"
                className="min-h-[80px] resize-none text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Session Notes</Label>
              <Textarea
                value={character.notes}
                onChange={(e) => updateNote(i, 'notes', e.target.value)}
                placeholder="Anything to watch for this session?"
                className="min-h-[80px] resize-none text-sm"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

