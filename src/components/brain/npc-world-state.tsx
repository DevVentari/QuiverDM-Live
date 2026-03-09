'use client';

import Link from 'next/link';
import { Brain } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

type Props = {
  npcId: string;
  npcName?: string;
  campaignId: string;
  slug: string;
  isDM: boolean;
};

const statusStyles: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  dormant: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  destroyed: 'bg-destructive/20 text-destructive border-destructive/30',
  resolved: 'bg-muted/20 text-muted-foreground border-border',
};

function PropertyRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

export function NpcWorldState({ npcId, campaignId, slug, isDM }: Props) {
  const entities = trpc.brain.entities.list.useQuery(
    { campaignId },
    { enabled: isDM, staleTime: 60_000 }
  );

  if (!isDM) return null;

  if (entities.isLoading) {
    return <Skeleton className="h-12 rounded-lg" />;
  }

  const entity = entities.data?.find(
    (e) => e.sourceType === 'NPC' && e.sourceId === npcId
  );

  const props = (entity?.properties ?? {}) as Record<string, unknown>;

  const strValue = (key: string): string | null => {
    const v = props[key];
    return v != null ? String(v) : null;
  };

  const entityHref = entity ? `/campaigns/${slug}/brain/entities/${entity.id}` : null;

  return (
    <Accordion type="single" collapsible className="glass-panel rounded-lg border border-amber-500/20">
      <AccordionItem value="world-state" className="border-0">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="text-sm font-semibold text-foreground">World State</span>
            {entity && (
              <Badge
                variant="outline"
                className={cn('ml-2 text-[10px] uppercase tracking-wider', statusStyles[entity.status] ?? statusStyles.active)}
              >
                {entity.status}
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4">
          {!entity ? (
            <p className="text-xs text-muted-foreground">
              No Brain data yet. Run <strong>Seed from Existing</strong> on the Brain tab.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                <PropertyRow label="Motivation" value={strValue('motivation')} />
                <PropertyRow label="Fear" value={strValue('fear')} />
                <PropertyRow label="Stress" value={strValue('stress')} />
                <PropertyRow label="Location" value={strValue('location')} />
                <PropertyRow label="Last Known Action" value={strValue('lastKnownAction')} />
                <PropertyRow label="Faction" value={strValue('faction')} />
                <PropertyRow label="Role" value={strValue('role')} />
              </div>
              {entityHref && (
                <Link
                  href={entityHref}
                  className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <Brain className="h-3 w-3" />
                  View full entity in Brain
                </Link>
              )}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
