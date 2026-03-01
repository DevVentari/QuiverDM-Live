'use client';

import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';

interface ResolvedStatsSummaryProps {
  characterId: string;
  baseAc: number;
}

export function ResolvedStatsSummary({ characterId, baseAc }: ResolvedStatsSummaryProps) {
  const { data } = trpc.characters.getResolvedStats.useQuery(
    { characterId },
    { staleTime: 60_000 }
  );

  if (!data) return null;

  const hasModifiers =
    data.acBonus !== 0 ||
    data.attackBonusBreakdown.length > 0 ||
    data.resistances.length > 0 ||
    data.immunities.length > 0 ||
    data.initiativeBonus !== 0;

  if (!hasModifiers) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {data.acBonus !== 0 && (
        <Badge variant="outline" className="text-xs">
          AC {baseAc + data.acBonus} <span className="text-muted-foreground ml-1">(+{data.acBonus} from effects)</span>
        </Badge>
      )}
      {data.attackBonusBreakdown.length > 0 && (
        <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/40">
          Attack +{data.attackBonusBreakdown.map((e) => e.value).join('+')}
        </Badge>
      )}
      {data.resistances.map((r) => (
        <Badge key={r} variant="secondary" className="text-xs capitalize">Resist: {r}</Badge>
      ))}
      {data.immunities.map((im) => (
        <Badge key={im} variant="secondary" className="text-xs capitalize">Immune: {im}</Badge>
      ))}
      {data.initiativeBonus !== 0 && (
        <Badge variant="outline" className="text-xs">Init +{data.initiativeBonus}</Badge>
      )}
    </div>
  );
}
