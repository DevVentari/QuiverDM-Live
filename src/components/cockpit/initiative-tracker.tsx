'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronUp, SkipForward, RotateCcw, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Combatant {
  id: string;
  name: string;
  initiative: number;
  isPlayer: boolean;
}

interface InitiativeTrackerProps {
  characterNames: string[];
}

export function InitiativeTracker({ characterNames }: InitiativeTrackerProps) {
  const [expanded, setExpanded] = useState(false);
  const [combatants, setCombatants] = useState<Combatant[]>(() =>
    characterNames.map((name, i) => ({
      id: `pc-${i}`,
      name,
      initiative: 0,
      isPlayer: true,
    }))
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [round, setRound] = useState(1);
  const [newName, setNewName] = useState('');
  const [newInit, setNewInit] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative);

  const nextTurn = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = (prev + 1) % sorted.length;
      if (next === 0) setRound((r) => r + 1);
      return next;
    });
  }, [sorted.length]);

  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'n' || e.key === 'N') {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
        nextTurn();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [expanded, nextTurn]);

  const updateInitiative = (id: string, value: string) => {
    const num = parseInt(value) || 0;
    setCombatants((prev) => prev.map((c) => c.id === id ? { ...c, initiative: num } : c));
  };

  const removeCombatant = (id: string) => {
    setCombatants((prev) => prev.filter((c) => c.id !== id));
  };

  const addCreature = () => {
    if (!newName.trim()) return;
    setCombatants((prev) => [...prev, {
      id: `creature-${Date.now()}`,
      name: newName.trim(),
      initiative: parseInt(newInit) || 0,
      isPlayer: false,
    }]);
    setNewName('');
    setNewInit('');
  };

  const reset = () => {
    setCurrentIndex(0);
    setRound(1);
    setCombatants((prev) => prev.map((c) => ({ ...c, initiative: 0 })));
  };

  const currentCombatantId = sorted[currentIndex]?.id;

  return (
    <div ref={containerRef} className="border-t border-border mt-2 pt-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-1"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Initiative
        {expanded && <span className="ml-auto font-mono text-amber-400/70">Rd {round}</span>}
      </button>

      {expanded && (
        <div className="space-y-1">
          {sorted.map((c, i) => (
            <div
              key={c.id}
              className={cn(
                'flex items-center gap-1.5 rounded px-1.5 py-1 text-xs transition-colors',
                c.id === currentCombatantId
                  ? 'bg-amber-500/10 border border-amber-500/30'
                  : 'border border-transparent'
              )}
            >
              <span className="font-mono text-muted-foreground w-4 text-center">{i + 1}</span>
              <span className={cn('flex-1 truncate', c.id === currentCombatantId ? 'text-amber-400 font-medium' : 'text-foreground')}>
                {c.name}
              </span>
              <Input
                type="number"
                value={c.initiative || ''}
                onChange={(e) => updateInitiative(c.id, e.target.value)}
                className="h-5 w-10 text-xs text-center px-1 bg-transparent border-border/50"
              />
              <button
                type="button"
                onClick={() => removeCombatant(c.id)}
                className="text-muted-foreground/40 hover:text-destructive transition-colors text-xs"
              >
                ×
              </button>
            </div>
          ))}

          {/* Add creature row */}
          <div className="flex items-center gap-1.5 pt-1">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Creature…"
              className="h-6 flex-1 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && addCreature()}
            />
            <Input
              type="number"
              value={newInit}
              onChange={(e) => setNewInit(e.target.value)}
              placeholder="0"
              className="h-6 w-10 text-xs text-center px-1"
              onKeyDown={(e) => e.key === 'Enter' && addCreature()}
            />
            <button type="button" onClick={addCreature} className="text-muted-foreground hover:text-amber-400 transition-colors">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Controls */}
          <div className="flex gap-1.5 pt-1">
            <Button
              size="sm"
              className="flex-1 h-7 text-xs gap-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30"
              onClick={nextTurn}
              disabled={sorted.length === 0}
            >
              <SkipForward className="h-3 w-3" />
              Next (N)
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1 text-muted-foreground"
              onClick={reset}
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
