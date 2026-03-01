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
  const { data: resolved, isLoading } = trpc.characters.getResolvedStats.useQuery(
    { characterId },
    { staleTime: 60_000 }
  );

  if (isLoading || !resolved) return null;

  const hasAny =
    resolved.acBonusBreakdown.length > 0 ||
    resolved.attackBonusBreakdown.length > 0 ||
    resolved.damageBonusBreakdown.length > 0 ||
    resolved.resistances.length > 0 ||
    resolved.immunities.length > 0 ||
    resolved.initiativeBonus !== 0 ||
    resolved.speedBonus !== 0 ||
    resolved.advantageOn.length > 0;

  if (!hasAny) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          Active Effects
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        {resolved.acBonusBreakdown.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              AC Bonus: +{resolved.acBonus} total
              {armorClass != null ? ` (effective ${armorClass + resolved.acBonus})` : ''}
            </p>
            <div className="flex flex-wrap gap-1">
              {resolved.acBonusBreakdown.map((e, i) => (
                <Badge key={i} variant="secondary" className="text-xs">+{e.value} {e.source}</Badge>
              ))}
            </div>
          </div>
        )}

        {resolved.attackBonusBreakdown.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Attack Bonus</p>
            <div className="flex flex-wrap gap-1">
              {resolved.attackBonusBreakdown.map((e, i) => (
                <Badge key={i} variant="secondary" className="text-xs">+{e.value} {e.source}</Badge>
              ))}
            </div>
          </div>
        )}

        {resolved.resistances.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Resistances</p>
            <div className="flex flex-wrap gap-1">
              {resolved.resistances.map((r) => (
                <Badge key={r} variant="outline" className="text-xs capitalize">{r}</Badge>
              ))}
            </div>
          </div>
        )}

        {resolved.immunities.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Immunities</p>
            <div className="flex flex-wrap gap-1">
              {resolved.immunities.map((im) => (
                <Badge key={im} variant="outline" className="text-xs capitalize">{im}</Badge>
              ))}
            </div>
          </div>
        )}

        {(resolved.initiativeBonus !== 0 || resolved.speedBonus !== 0) && (
          <div className="flex gap-2">
            {resolved.initiativeBonus !== 0 && (
              <Badge variant="outline" className="text-xs">Init +{resolved.initiativeBonus}</Badge>
            )}
            {resolved.speedBonus !== 0 && (
              <Badge variant="outline" className="text-xs">Speed +{resolved.speedBonus}ft</Badge>
            )}
          </div>
        )}

        {resolved.advantageOn.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Advantage On</p>
            <div className="flex flex-wrap gap-1">
              {resolved.advantageOn.map((a) => (
                <Badge key={a} variant="secondary" className="text-xs capitalize">{a}</Badge>
              ))}
            </div>
          </div>
        )}

        {resolved.hasConcentrationAdvantage && (
          <Badge variant="secondary" className="text-xs">Advantage: Concentration saves</Badge>
        )}
      </CardContent>
    </Card>
  );
}
