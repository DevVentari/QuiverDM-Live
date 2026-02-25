'use client';

import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Zap } from 'lucide-react';

interface CharacterActiveEffectsProps {
  characterId: string;
  abilityScores?: Record<string, number> | null;
  armorClass?: number | null;
}

export function CharacterActiveEffects({
  characterId,
  abilityScores,
  armorClass,
}: CharacterActiveEffectsProps) {
  const { data: equippedItems, isLoading } = trpc.characters.getEquippedEffects.useQuery(
    { characterId },
    { staleTime: 60_000 }
  );

  if (isLoading || !equippedItems) return null;

  const allEffects = equippedItems.flatMap((item) =>
    item.effects.map((effect) => ({ ...effect, itemName: item.itemName, itemId: item.itemId }))
  );

  if (allEffects.length === 0) return null;

  const effectCount = allEffects.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          Active Effects
          <Badge variant="secondary" className="text-xs ml-auto">{effectCount}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Accordion type="multiple">
          {allEffects.map((effect, idx) => {
            // Compute stat summary for ac_bonus / ability_bonus
            let statSummary: string | null = null;
            const mech = (effect as any).mechanic;
            if (mech && typeof mech.value === 'number') {
              if (mech.type === 'ac_bonus' && armorClass != null) {
                statSummary = `AC: ${armorClass} + ${mech.value} = ${armorClass + mech.value}`;
              } else if (mech.type === 'ability_bonus' && mech.target && abilityScores) {
                const key = (mech.target as string).toLowerCase();
                const base = abilityScores[key];
                if (base != null) {
                  statSummary = `${(mech.target as string).toUpperCase()}: ${base} + ${mech.value} = ${base + mech.value}`;
                }
              }
            }

            return (
              <AccordionItem key={idx} value={String(idx)} className="px-4">
                <AccordionTrigger className="py-2.5 text-sm font-medium hover:no-underline">
                  <span>{effect.name}</span>
                  <span className="text-xs text-muted-foreground font-normal ml-2">
                    {effect.itemName}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-3 text-sm text-muted-foreground">
                  <p className="whitespace-pre-wrap">{effect.description}</p>
                  {mech && (
                    <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                      <Badge variant="secondary" className="text-xs capitalize">
                        {mech.type.replace(/_/g, ' ')}
                      </Badge>
                      {mech.target && (
                        <Badge variant="outline" className="text-xs">{mech.target}</Badge>
                      )}
                      {mech.value != null && (
                        <Badge variant="outline" className="text-xs">+{mech.value}</Badge>
                      )}
                      {mech.condition && (
                        <span className="text-xs italic text-muted-foreground">{mech.condition}</span>
                      )}
                      {statSummary && (
                        <span className="text-xs font-medium text-foreground ml-1">{statSummary}</span>
                      )}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
