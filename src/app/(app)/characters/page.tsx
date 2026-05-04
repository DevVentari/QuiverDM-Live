'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, RefreshCw, Loader2, Sword } from 'lucide-react';
import type { MouseEvent } from 'react';
import { CharacterAddSheet } from '@/components/character/CharacterAddSheet';

function CharactersPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const characters = trpc.characters.getMyCharacters.useQuery(undefined, { staleTime: 120_000 });
  const isCreateOpen = searchParams.get('create') === 'true';

  const syncCharacter = trpc.charactersDndBeyond.syncCharacter.useMutation({
    onSuccess: async (data) => {
      const synced = data.character as { name: string };
      await utils.characters.getMyCharacters.invalidate();
      toast({ title: 'Character synced', description: `${synced.name} was synced from D&D Beyond.` });
    },
    onError: (error) => {
      toast({ title: 'Sync failed', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-6 max-w-6xl 2xl:max-w-[1500px] px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-display font-bold tracking-wide">Characters</h1>
        <Button onClick={() => router.push('?create=true')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Character
        </Button>
      </div>

      {characters.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : characters.data && characters.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(characters.data as any[]).map((char) => (
            <div key={char.id} className="stone-card overflow-hidden relative group min-h-[130px]">
              <Link href={`/characters/${char.id}`} className="absolute inset-0 z-0" aria-label={char.name} />
              <div className="flex h-full min-h-[130px]">
                <div className="relative w-[28%] shrink-0 self-stretch">
                  {char.portraitUrl ? (
                    <Image
                      src={char.portraitUrl}
                      alt={char.name}
                      fill
                      className="object-cover object-top"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-b from-[hsl(240,10%,8%)] via-[hsl(240,8%,6%)] to-[hsl(35,15%,5%)] flex items-center justify-center">
                      <Users className="h-7 w-7 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[hsl(240,10%,11%)] to-transparent pointer-events-none" />
                </div>
                <div className="flex-1 min-w-0 px-4 py-3 flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="stone-card-title leading-snug">{char.name}</span>
                    {char.dndBeyondId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="relative z-10 h-6 w-6 p-0 shrink-0 text-muted-foreground/50 hover:text-foreground"
                        disabled={syncCharacter.isPending}
                        onClick={(e: MouseEvent) => {
                          e.preventDefault();
                          syncCharacter.mutate({ characterId: char.id });
                        }}
                        title="Sync from D&D Beyond"
                      >
                        {syncCharacter.isPending && syncCharacter.variables?.characterId === char.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">
                    {[char.race, char.class, char.level && `Level ${char.level}`]
                      .filter(Boolean)
                      .join(' · ') || 'No details'}
                  </p>
                  {char.backstory ? (
                    <p className="text-xs text-muted-foreground/60 line-clamp-2 mt-auto leading-relaxed">
                      {char.backstory}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground/40 mt-auto italic">No backstory yet</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="stone-card">
          <div className="stone-card-body flex flex-col items-center justify-center py-16 text-center">
            <Sword className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No characters yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Import a character from D&D Beyond or create one manually.
            </p>
            <Button size="sm" onClick={() => router.push('?create=true')}>
              Add Character
            </Button>
          </div>
        </div>
      )}

      <CharacterAddSheet
        open={isCreateOpen}
        onOpenChange={(open) => {
          if (!open) router.replace('/characters');
        }}
      />
    </div>
  );
}

export default function CharactersPage() {
  return (
    <Suspense>
      <CharactersPageInner />
    </Suspense>
  );
}
