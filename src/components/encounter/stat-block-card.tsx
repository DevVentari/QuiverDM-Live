'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SrdMonster } from '@/lib/srd/monsters';

interface StatBlockCardProps {
  monster: Partial<SrdMonster> & { name: string };
  compact?: boolean;
  onAdd?: (count: number) => void;
  className?: string;
}

function abilityMod(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function formatSpeed(speed: Record<string, number | string> | undefined): string {
  if (!speed) return '30 ft.';
  return Object.entries(speed)
    .map(([type, val]) => {
      if (type === 'walk') return `${val} ft.`;
      return `${type} ${val} ft.`;
    })
    .join(', ');
}

function AbilityScore({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs font-bold uppercase text-foreground/60">{label}</span>
      <span className="text-sm font-bold">{score}</span>
      <span className="text-xs text-muted-foreground">({abilityMod(score)})</span>
    </div>
  );
}

export function StatBlockCard({ monster, compact = false, onAdd, className }: StatBlockCardProps) {
  const [expanded, setExpanded] = useState(!compact);
  const [addCount, setAddCount] = useState(1);

  const scores = monster.abilityScores;
  const saves = monster.savingThrows;

  const savingThrowStr = saves
    ? Object.entries(saves)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)} ${v! >= 0 ? '+' : ''}${v}`)
        .join(', ')
    : '';

  const skillStr = monster.skills
    ? Object.entries(monster.skills)
        .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)} ${v >= 0 ? '+' : ''}${v}`)
        .join(', ')
    : '';

  return (
    <div
      className={cn(
        'border border-amber-800/30 rounded bg-amber-950/10 text-sm',
        className
      )}
    >
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-left"
        onClick={() => compact && setExpanded((e) => !e)}
      >
        <div>
          <span className="font-bold text-foreground">{monster.name}</span>
          {monster.size && monster.type && (
            <span className="ml-2 text-xs text-muted-foreground">
              {monster.size} {monster.type}
              {monster.alignment ? `, ${monster.alignment}` : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {monster.challengeRating && (
            <span className="text-xs font-semibold text-amber-600">
              CR {monster.challengeRating} ({monster.xp?.toLocaleString() ?? '?'} XP)
            </span>
          )}
          {compact &&
            (expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ))}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="border-t border-amber-800/30 pt-2 space-y-1 text-xs">
            {monster.armorClass != null && (
              <div>
                <span className="font-semibold">Armor Class</span>{' '}
                {monster.armorClass}
                {monster.armorDesc ? ` (${monster.armorDesc})` : ''}
              </div>
            )}
            {monster.hitPoints != null && (
              <div>
                <span className="font-semibold">Hit Points</span>{' '}
                {monster.hitPoints}
                {monster.hitDice ? ` (${monster.hitDice})` : ''}
              </div>
            )}
            {monster.speed && (
              <div>
                <span className="font-semibold">Speed</span> {formatSpeed(monster.speed)}
              </div>
            )}
          </div>

          {/* Ability Scores */}
          {scores && (
            <div className="border-t border-amber-800/30 pt-2 grid grid-cols-6 gap-1">
              <AbilityScore label="STR" score={scores.str} />
              <AbilityScore label="DEX" score={scores.dex} />
              <AbilityScore label="CON" score={scores.con} />
              <AbilityScore label="INT" score={scores.int} />
              <AbilityScore label="WIS" score={scores.wis} />
              <AbilityScore label="CHA" score={scores.cha} />
            </div>
          )}

          {/* Secondary stats */}
          <div className="border-t border-amber-800/30 pt-2 space-y-1 text-xs">
            {savingThrowStr && (
              <div>
                <span className="font-semibold">Saving Throws</span> {savingThrowStr}
              </div>
            )}
            {skillStr && (
              <div>
                <span className="font-semibold">Skills</span> {skillStr}
              </div>
            )}
            {monster.damageImmunities && (
              <div>
                <span className="font-semibold">Damage Immunities</span> {monster.damageImmunities}
              </div>
            )}
            {monster.damageResistances && (
              <div>
                <span className="font-semibold">Damage Resistances</span> {monster.damageResistances}
              </div>
            )}
            {monster.conditionImmunities && (
              <div>
                <span className="font-semibold">Condition Immunities</span>{' '}
                {monster.conditionImmunities}
              </div>
            )}
            {monster.senses && (
              <div>
                <span className="font-semibold">Senses</span> {monster.senses}
              </div>
            )}
            {monster.languages && (
              <div>
                <span className="font-semibold">Languages</span> {monster.languages}
              </div>
            )}
          </div>

          {/* Traits */}
          {monster.traits && monster.traits.length > 0 && (
            <div className="border-t border-amber-800/30 pt-2 space-y-1 text-xs">
              {monster.traits.map((trait, i) => (
                <div key={i}>
                  <span className="font-semibold italic">{trait.name}.</span>{' '}
                  <span className="text-foreground/80">{trait.desc}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          {monster.actions && monster.actions.length > 0 && (
            <div className="border-t border-amber-800/30 pt-2 space-y-1 text-xs">
              <div className="font-bold text-sm uppercase tracking-wide text-amber-700">Actions</div>
              {monster.actions.map((action, i) => (
                <div key={i}>
                  <span className="font-semibold italic">{action.name}.</span>{' '}
                  <span className="text-foreground/80">{action.desc}</span>
                </div>
              ))}
            </div>
          )}

          {/* Reactions */}
          {monster.reactions && monster.reactions.length > 0 && (
            <div className="border-t border-amber-800/30 pt-2 space-y-1 text-xs">
              <div className="font-bold text-sm uppercase tracking-wide text-amber-700">
                Reactions
              </div>
              {monster.reactions.map((r, i) => (
                <div key={i}>
                  <span className="font-semibold italic">{r.name}.</span>{' '}
                  <span className="text-foreground/80">{r.desc}</span>
                </div>
              ))}
            </div>
          )}

          {/* Legendary Actions */}
          {monster.legendaryActions && monster.legendaryActions.length > 0 && (
            <div className="border-t border-amber-800/30 pt-2 space-y-1 text-xs">
              <div className="font-bold text-sm uppercase tracking-wide text-amber-700">
                Legendary Actions
              </div>
              {monster.legendaryDesc && (
                <p className="text-foreground/70 italic mb-1">{monster.legendaryDesc}</p>
              )}
              {monster.legendaryActions.map((la, i) => (
                <div key={i}>
                  <span className="font-semibold italic">{la.name}.</span>{' '}
                  <span className="text-foreground/80">{la.desc}</span>
                </div>
              ))}
            </div>
          )}

          {/* Add button */}
          {onAdd && (
            <div className="border-t border-amber-800/30 pt-2 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={20}
                value={addCount}
                onChange={(e) => setAddCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-14 px-2 py-1 rounded border border-border bg-background text-sm text-center"
              />
              <button
                onClick={() => onAdd(addCount)}
                className="flex-1 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded hover:bg-primary/90 transition-colors"
              >
                Add to Encounter
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
