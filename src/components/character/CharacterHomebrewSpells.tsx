'use client';

import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CharacterHomebrewSpellsProps {
  characterId: string;
}

export function CharacterHomebrewSpells({ characterId }: CharacterHomebrewSpellsProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: character } = trpc.characters.getCharacterWithHomebrew.useQuery({
    characterId,
  });

  const removeSpell = trpc.characters.removeHomebrewSpell.useMutation({
    onSuccess: () => {
      utils.characters.getCharacterWithHomebrew.invalidate({ characterId });
      toast({
        title: 'Spell removed',
        description: 'Spell removed from character',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (!character || !character.homebrewSpells?.length) {
    return (
      <div className="text-sm text-muted-foreground">
        No homebrew spells yet. Import a PDF with spells or add them manually.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {character.homebrewSpells.map((characterSpell) => (
        <div
          key={characterSpell.id}
          className="flex items-center justify-between p-3 border rounded-lg"
        >
          <div className="flex-1">
            <div className="font-medium">{characterSpell.homebrew.name}</div>
            <div className="text-sm text-muted-foreground">
              {characterSpell.prepared ? 'Prepared' : 'Not prepared'}
              {characterSpell.alwaysPrepared && ' - Always prepared'}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              removeSpell.mutate({
                characterId,
                homebrewId: characterSpell.homebrewId,
              })
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
