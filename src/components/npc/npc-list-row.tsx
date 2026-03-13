'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface NpcListRowProps {
  npc: {
    id: string;
    name: string;
    faction?: string | null;
    imageUrl?: string | null;
    description?: string | null;
  };
  isSelected: boolean;
  onClick: () => void;
}

export function NpcListRow({ npc, isSelected, onClick }: NpcListRowProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
        isSelected
          ? 'bg-amber-500/10 border-l-2 border-primary'
          : 'border-l-2 border-transparent hover:bg-white/[0.04] hover:border-white/10'
      )}
    >
      {/* Avatar */}
      <div className="relative h-9 w-9 shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-stone-800 to-stone-900">
        {npc.imageUrl ? (
          <Image src={npc.imageUrl} alt={npc.name} fill className="object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full w-full text-xs font-bold text-amber-500/60 font-display">
            {npc.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Name + faction */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium truncate',
          isSelected ? 'text-foreground' : 'text-muted-foreground'
        )}>
          {npc.name}
        </p>
        {npc.faction && (
          <p className="text-[10px] text-muted-foreground/60 truncate">{npc.faction}</p>
        )}
      </div>
    </button>
  );
}
