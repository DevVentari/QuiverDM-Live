'use client';

import Image from 'next/image';
import { X } from 'lucide-react';
import { usePinnedCharacters } from '@/store/pinned-characters-store';
import { CharacterSheetDrawer } from '@/components/character/CharacterSheetDrawer';

export function PinnedCharacterFlags() {
  const { pinned, openSheet, unpin } = usePinnedCharacters();

  return (
    <>
      <CharacterSheetDrawer />

      {pinned.length > 0 && (
        <div
          className="fixed right-0 z-40 flex flex-col gap-1.5 pointer-events-none"
          style={{ top: '50%', transform: 'translateY(-50%)' }}
        >
          {pinned.map((char) => (
            <div key={char.characterId} className="group relative pointer-events-auto">
              <button
                onClick={() => openSheet(char)}
                className="flex items-center justify-center w-11 h-[52px] rounded-l-xl border border-r-0 border-amber-800/35 bg-[hsl(240,10%,8%)] hover:bg-[hsl(240,10%,11%)] hover:border-amber-700/50 transition-all duration-150 shadow-[-2px_0_8px_rgba(0,0,0,0.4)]"
                title={char.name}
              >
                {char.portraitUrl ? (
                  <div className="relative h-8 w-8 rounded-full overflow-hidden border border-amber-800/40 shrink-0">
                    <Image
                      src={char.portraitUrl}
                      alt={char.name}
                      fill
                      className="object-cover object-top"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="h-8 w-8 rounded-full border border-amber-800/30 bg-amber-950/40 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-amber-600/80 font-display">
                      {char.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </button>

              <div className="absolute right-11 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-100 whitespace-nowrap">
                <div className="rounded-l-md border border-r-0 border-amber-800/35 bg-[hsl(240,10%,8%)] px-2.5 py-1 text-xs font-medium text-foreground/80 shadow-[-2px_0_8px_rgba(0,0,0,0.4)]">
                  {char.name}
                </div>
              </div>

              <button
                onClick={() => unpin(char.characterId)}
                className="absolute -top-1 -left-1.5 h-4 w-4 rounded-full bg-[hsl(240,10%,14%)] border border-border/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/80 hover:border-destructive/60"
                title="Unpin"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
