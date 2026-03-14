'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PlayerSessionState } from '@/hooks/use-player-session';

const CONDITIONS = ['Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious'];

interface MyCharacterPanelProps {
  state: PlayerSessionState;
  onChange: (update: Partial<PlayerSessionState>) => void;
}

export function MyCharacterPanel({ state, onChange }: MyCharacterPanelProps) {
  const [editing, setEditing] = useState(false);
  const [hpInput, setHpInput] = useState(String(state.hp));
  const hpPct = Math.max(0, Math.min(1, state.hp / state.maxHp));

  function applyHp() {
    const val = parseInt(hpInput);
    if (!isNaN(val)) onChange({ hp: Math.max(0, Math.min(state.maxHp + state.tempHp, val)) });
    setEditing(false);
  }

  function toggleCondition(c: string) {
    const next = state.conditions.includes(c)
      ? state.conditions.filter(x => x !== c)
      : [...state.conditions, c];
    onChange({ conditions: next });
  }

  return (
    <div className="p-4 space-y-4">
      <div className="stone-card p-4">
        <p className="overline-label mb-2">Hit Points</p>
        <div className="flex items-center gap-3 mb-2">
          <Button variant="outline" size="icon" className="h-9 w-9 text-lg shrink-0"
            onClick={() => onChange({ hp: Math.max(0, state.hp - 1) })}>−</Button>
          {editing ? (
            <input
              type="number"
              value={hpInput}
              onChange={e => setHpInput(e.target.value)}
              onBlur={applyHp}
              onKeyDown={e => e.key === 'Enter' && applyHp()}
              className="w-20 text-center text-2xl font-mono font-bold bg-transparent border-b border-amber-500 outline-none"
              autoFocus
            />
          ) : (
            <button onClick={() => { setEditing(true); setHpInput(String(state.hp)); }}
              className="text-2xl font-mono font-bold hover:text-amber-400 transition-colors">
              {state.hp} <span className="text-sm text-muted-foreground font-normal">/ {state.maxHp}</span>
            </button>
          )}
          <Button variant="outline" size="icon" className="h-9 w-9 text-lg shrink-0"
            onClick={() => onChange({ hp: Math.min(state.maxHp, state.hp + 1) })}>+</Button>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', hpPct > 0.5 ? 'bg-emerald-500' : hpPct > 0.25 ? 'bg-amber-500' : 'bg-red-500')}
            style={{ width: `${hpPct * 100}%` }} />
        </div>
        {state.tempHp > 0 && <p className="text-xs text-sky-400 mt-1">+{state.tempHp} temp</p>}
      </div>
      <div className="stone-card p-4">
        <p className="overline-label mb-2">Conditions</p>
        <div className="flex flex-wrap gap-1.5">
          {CONDITIONS.map(c => (
            <button key={c} onClick={() => toggleCondition(c)}
              className={cn('text-xs px-2 py-0.5 rounded-full border transition-colors',
                state.conditions.includes(c)
                  ? 'bg-red-500/20 border-red-500/50 text-red-300'
                  : 'bg-white/5 border-white/10 text-muted-foreground hover:border-white/20')}>
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
