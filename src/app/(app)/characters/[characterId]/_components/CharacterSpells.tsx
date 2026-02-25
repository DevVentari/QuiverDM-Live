'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Wand2, Dices } from 'lucide-react';
import { SpellSlotPips } from '@/components/character/SpellSlotPips';
import type { DiceRoll } from '@/lib/dice';
import { htmlToText } from '@/lib/html-utils';

const LEVEL_LABELS: Record<number, string> = {
  0: 'Cantrips',
  1: '1st Level',
  2: '2nd Level',
  3: '3rd Level',
  4: '4th Level',
  5: '5th Level',
  6: '6th Level',
  7: '7th Level',
  8: '8th Level',
  9: '9th Level',
};

type CharacterSpellsProps = {
  data: any;
  onUpdate?: (patch: any) => Promise<void>;
  onRoll?: (notation: string, label?: string) => DiceRoll;
  isUpdating?: boolean;
};

function extractDiceNotation(damage: string): string | null {
  const match = damage.match(/(\d+)d(\d+)(\s*[+-]\s*\d+)?/i);
  if (!match) return null;
  return `${match[1]}d${match[2]}${(match[3] || '').replace(/\s+/g, '')}`;
}

export function CharacterSpells({ data, onUpdate, onRoll, isUpdating }: CharacterSpellsProps) {
  const spellcasting = data.spellcasting as any;
  const [preparedOnly, setPreparedOnly] = useState(false);

  if (!spellcasting) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Wand2 className="h-8 w-8 mb-2" />
        <p>Not a spellcaster</p>
      </div>
    );
  }

  const { spells, slots, ability } = spellcasting;

  const filteredSpells = preparedOnly
    ? (spells || []).filter((s: any) => s.prepared || s.alwaysPrepared || s.level === 0)
    : spells || [];

  const grouped: Record<number, any[]> = {};
  for (const spell of filteredSpells) {
    const lvl = spell.level ?? 0;
    if (!grouped[lvl]) grouped[lvl] = [];
    grouped[lvl].push(spell);
  }

  const sortedLevels = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        {ability && (
          <div className="text-sm">
            <span className="text-muted-foreground">Casting Ability: </span>
            <span className="font-medium capitalize">{ability}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Switch
            id="prepared-only"
            checked={preparedOnly}
            onCheckedChange={setPreparedOnly}
          />
          <Label htmlFor="prepared-only" className="text-sm">
            Prepared Only
          </Label>
        </div>
      </div>

      {slots && Object.keys(slots).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-display tracking-wide">Spell Slots</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Object.entries(slots).map(([key, slot]: [string, any]) => {
                const level = Number(key.replace('level', ''));
                const remaining = slot.total - slot.used;
                return (
                  <div key={key} className="text-center space-y-1">
                    <div className="text-xs text-muted-foreground">
                      {LEVEL_LABELS[level] || `Level ${level}`}
                    </div>
                    <div className="flex justify-center">
                      <SpellSlotPips
                        total={slot.total}
                        used={slot.used}
                        disabled={isUpdating}
                        onChangeUsed={async (nextUsed) => {
                          if (!onUpdate) return;
                          await onUpdate({
                            spellcasting: {
                              ...spellcasting,
                              slots: {
                                ...slots,
                                [key]: {
                                  ...slot,
                                  used: nextUsed,
                                },
                              },
                            },
                          });
                        }}
                      />
                    </div>
                    <div className="text-xs mt-0.5">{remaining}/{slot.total}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {sortedLevels.map((level) => (
        <Card key={level}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display tracking-wide flex items-center gap-2">
              {LEVEL_LABELS[level] || `Level ${level}`}
              <Badge variant="secondary" className="text-xs font-sans">
                {grouped[level].length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {grouped[level]
                .sort((a: any, b: any) => a.name.localeCompare(b.name))
                .map((spell: any, idx: number) => {
                  const canRollDamage = typeof spell.damage === 'string' && !!extractDiceNotation(spell.damage);
                  return (
                    <AccordionItem key={`${spell.name}-${idx}`} value={`${spell.name}-${idx}`}>
                      <AccordionTrigger className="py-2 text-sm hover:no-underline">
                        <div className="flex items-center gap-2 flex-wrap text-left min-w-0">
                          <span className="font-medium">{spell.name}</span>
                          {spell.castingTime && (
                            <span className="text-[11px] text-muted-foreground/70 hidden sm:inline">
                              {spell.castingTime}
                              {spell.range ? ` · ${spell.range}` : ''}
                            </span>
                          )}
                          {spell.school && (
                            <Badge variant="outline" className="text-xs">
                              {spell.school}
                            </Badge>
                          )}
                          {spell.concentration && (
                            <Badge variant="secondary" className="text-xs">
                              C
                            </Badge>
                          )}
                          {spell.ritual && (
                            <Badge variant="secondary" className="text-xs">
                              R
                            </Badge>
                          )}
                          {spell.alwaysPrepared && (
                            <Badge variant="default" className="text-xs">
                              Always
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-sm space-y-2 pb-3">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                          {spell.castingTime && (
                            <div>
                              <span className="font-medium text-foreground">Casting Time:</span>{' '}
                              {spell.castingTime}
                            </div>
                          )}
                          {spell.range && (
                            <div>
                              <span className="font-medium text-foreground">Range:</span>{' '}
                              {spell.range}
                            </div>
                          )}
                          {spell.duration && (
                            <div>
                              <span className="font-medium text-foreground">Duration:</span>{' '}
                              {spell.duration}
                            </div>
                          )}
                          {spell.components?.length > 0 && (
                            <div>
                              <span className="font-medium text-foreground">Components:</span>{' '}
                              {spell.components.join(', ')}
                            </div>
                          )}
                          {spell.damage && (
                            <div>
                              <span className="font-medium text-foreground">Damage:</span> {spell.damage}
                            </div>
                          )}
                          {spell.savingThrow && (
                            <div>
                              <span className="font-medium text-foreground">Save:</span>{' '}
                              <span className="capitalize">{spell.savingThrow}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {onRoll && (
                            <button
                              type="button"
                              onClick={() => {
                                const bonus = Number(data.proficiencyBonus ?? 2) + Math.floor((((data.abilityScores as any)?.[spellcasting?.ability] ?? 10) - 10) / 2);
                                onRoll(`1d20${bonus >= 0 ? `+${bonus}` : bonus}`, `${spell.name} Attack`);
                              }}
                              className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted"
                            >
                              <Dices className="h-3 w-3" />
                              Roll Attack
                            </button>
                          )}
                          {onRoll && canRollDamage && (
                            <button
                              type="button"
                              onClick={() => {
                                const notation = extractDiceNotation(spell.damage);
                                if (notation) onRoll(notation, `${spell.name} Damage`);
                              }}
                              className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted"
                            >
                              <Dices className="h-3 w-3" />
                              Roll Damage
                            </button>
                          )}
                        </div>

                        {spell.description && (
                          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {htmlToText(spell.description)}
                          </p>
                        )}
                        {spell.atHigherLevels && (
                          <div className="mt-1">
                            <span className="font-medium text-foreground text-xs">At Higher Levels:</span>
                            <p className="text-muted-foreground text-xs mt-0.5 whitespace-pre-wrap">
                              {htmlToText(spell.atHigherLevels)}
                            </p>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
            </Accordion>
          </CardContent>
        </Card>
      ))}

      {sortedLevels.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No spells {preparedOnly ? 'prepared' : 'known'}
        </div>
      )}
    </div>
  );
}

