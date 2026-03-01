'use client';

import { Swords, MessageSquare } from 'lucide-react';

interface ModeSwitcherProps {
  mode: 'rp' | 'combat';
  onToggle: () => void;
}

export function ModeSwitcher({ mode, onToggle }: ModeSwitcherProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
      <button
        type="button"
        onClick={() => mode === 'combat' && onToggle()}
        className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === 'rp'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        RP
      </button>
      <button
        type="button"
        onClick={() => mode === 'rp' && onToggle()}
        className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === 'combat'
            ? 'bg-red-500/20 text-red-400 shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Swords className="h-3.5 w-3.5" />
        Combat
      </button>
    </div>
  );
}
