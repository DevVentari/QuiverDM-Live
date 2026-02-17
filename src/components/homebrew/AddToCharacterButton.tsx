'use client';

import { useState } from 'react';
import Image from 'next/image';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type LinkableHomebrewType = 'item' | 'spell' | 'feat';

interface AddToCharacterButtonProps {
  homebrewId: string;
  homebrewName: string;
  homebrewType: LinkableHomebrewType;
}

export function AddToCharacterButton({
  homebrewId,
  homebrewName,
  homebrewType,
}: AddToCharacterButtonProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: characters } = trpc.characters.getMyCharacters.useQuery();
  const addItem = trpc.characters.addHomebrewItem.useMutation();
  const addSpell = trpc.characters.addHomebrewSpell.useMutation();
  const addFeat = trpc.characters.addHomebrewFeat.useMutation();

  const handleAddToCharacter = async (characterId: string) => {
    try {
      if (homebrewType === 'item') {
        await addItem.mutateAsync({
          characterId,
          homebrewId,
          quantity: 1,
        });
      } else if (homebrewType === 'spell') {
        await addSpell.mutateAsync({
          characterId,
          homebrewId,
          prepared: false,
        });
      } else {
        await addFeat.mutateAsync({
          characterId,
          homebrewId,
        });
      }

      toast({
        title: 'Success',
        description: `${homebrewName} added to character`,
      });
      setOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add to character',
        variant: 'destructive',
      });
    }
  };

  if (!characters || characters.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add to Character
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {homebrewName} to Character</DialogTitle>
          <DialogDescription>
            Select which character should receive this {homebrewType}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {characters.map((character) => (
            <Button
              key={character.id}
              variant="outline"
              className="w-full justify-start h-auto py-2"
              onClick={() => handleAddToCharacter(character.id)}
              disabled={
                addItem.isPending || addSpell.isPending || addFeat.isPending
              }
            >
              <div className="flex items-center gap-3">
                {character.portraitUrl ? (
                  <Image
                    src={character.portraitUrl}
                    alt={character.name}
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-muted" />
                )}
                <div className="text-left">
                  <div className="font-medium">{character.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Level {character.level}
                    {character.race ? ` ${character.race}` : ''}
                    {character.class ? ` ${character.class}` : ''}
                  </div>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
