'use client';

import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CharacterHomebrewItemsProps {
  characterId: string;
}

export function CharacterHomebrewItems({ characterId }: CharacterHomebrewItemsProps) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: character } = trpc.characters.getCharacterWithHomebrew.useQuery({
    characterId,
  });

  const removeItem = trpc.characters.removeHomebrewItem.useMutation({
    onSuccess: () => {
      utils.characters.getCharacterWithHomebrew.invalidate({ characterId });
      toast({
        title: 'Item removed',
        description: 'Item removed from character',
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

  if (!character || !character.homebrewItems?.length) {
    return (
      <div className="text-sm text-muted-foreground">
        No homebrew items yet. Import a PDF with items or add them manually.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {character.homebrewItems.map((characterItem) => (
        <div
          key={characterItem.id}
          className="flex items-center justify-between p-3 border rounded-lg"
        >
          <div className="flex-1">
            <div className="font-medium">{characterItem.homebrew.name}</div>
            <div className="text-sm text-muted-foreground">
              Quantity: {characterItem.quantity}
              {characterItem.equipped && ' - Equipped'}
              {characterItem.attuned && ' - Attuned'}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              removeItem.mutate({
                characterId,
                homebrewId: characterItem.homebrewId,
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
