'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Sword } from 'lucide-react';
import { CharacterAddSheet } from '@/components/character/CharacterAddSheet';
import { CharacterCard, type CharacterCardData } from '@/components/character/CharacterCard';
import { CharacterQuickViewSheet } from '@/components/character/CharacterQuickViewSheet';

function CharactersPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const characters = trpc.characters.getMyCharacters.useQuery(undefined, { staleTime: 120_000 });
  const isCreateOpen = searchParams.get('create') === 'true';

  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const quickViewChar = quickViewId
    ? ((characters.data as CharacterCardData[] | undefined)?.find((c) => c.id === quickViewId) ?? null)
    : null;

  return (
    <div className="space-y-6 max-w-6xl 2xl:max-w-[1500px] px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="label-overline mb-1">Library</p>
        <div className="section-rule" />
        <h1 className="font-[var(--q-font-display)] text-3xl text-[var(--q-text)] mt-1">
          Characters
        </h1>
      </div>
      <div className="flex sm:justify-end">
        <Button onClick={() => router.push('?create=true')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Character
        </Button>
      </div>

      {characters.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[240px] rounded-lg" />
          ))}
        </div>
      ) : characters.data && characters.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(characters.data as CharacterCardData[]).map((char) => (
            <CharacterCard
              key={char.id}
              character={char}
              onQuickView={() => setQuickViewId(char.id)}
            />
          ))}
        </div>
      ) : (
        <div className="stone-card">
          <div className="stone-card-body flex flex-col items-center justify-center py-16 text-center">
            <Sword className="h-12 w-12 text-[var(--q-text-dim)]/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No characters yet</h3>
            <p className="text-sm text-[var(--q-text-dim)] mb-6 max-w-sm">
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

      <CharacterQuickViewSheet
        character={quickViewChar}
        open={quickViewId !== null}
        onOpenChange={(v) => { if (!v) setQuickViewId(null); }}
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
