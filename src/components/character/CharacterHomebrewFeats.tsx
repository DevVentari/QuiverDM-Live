'use client';

import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CharacterHomebrewFeatsProps {
  characterId: string;
}

export function CharacterHomebrewFeats({ characterId }: CharacterHomebrewFeatsProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: character } = trpc.characters.getCharacterWithHomebrew.useQuery({
    characterId,
  });

  const removeFeat = trpc.characters.removeHomebrewFeat.useMutation({
    onSuccess: () => {
      utils.characters.getCharacterWithHomebrew.invalidate({ characterId });
      toast({
        title: 'Feat removed',
        description: 'Feat removed from character',
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

  if (!character || !character.homebrewFeats?.length) {
    return (
      <div className="text-sm text-muted-foreground">
        No homebrew feats yet. Import a PDF with feats or add them manually.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {character.homebrewFeats.map((characterFeat) => (
        <div
          key={characterFeat.id}
          className="flex items-center justify-between p-3 border rounded-lg"
        >
          <div className="flex-1">
            <div className="font-medium">{characterFeat.homebrew.name}</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              removeFeat.mutate({
                characterId,
                homebrewId: characterFeat.homebrewId,
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
