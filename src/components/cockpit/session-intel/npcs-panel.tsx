'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { Star, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NpcsPanelProps {
  campaignId: string;
  sessionId: string;
}

type TriggeredBehavior = { condition: string; behavior: string };
type CriticalDialogueLine = { line: string; trigger: string };

export function NpcsPanel({ campaignId, sessionId }: NpcsPanelProps) {
  const [inPlayIds, setInPlayIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const profilesQuery = trpc.npcBehaviorProfiles.listBySession.useQuery({ campaignId, sessionId });
  const secretsQuery = trpc.prepSecrets.list.useQuery({ campaignId, sessionId });

  if (profilesQuery.isLoading || secretsQuery.isLoading) {
    return <div className="p-3 text-xs text-muted-foreground">Loading NPCs...</div>;
  }

  const profiles = profilesQuery.data ?? [];
  const secrets = secretsQuery.data ?? [];

  // Build worldEntityId → secrets[] map from PrepKnowledge
  const entitySecretMap = new Map<string, typeof secrets>();
  for (const secret of secrets) {
    for (const k of secret.knowledge) {
      const existing = entitySecretMap.get(k.worldEntityId) ?? [];
      entitySecretMap.set(k.worldEntityId, [...existing, secret]);
    }
  }

  // Collect entity ids from behavior profiles
  const profileEntityIds = new Set(profiles.map((p) => p.worldEntity.id));

  // Collect unprofiled entities referenced in secrets knowledge
  const unprofiledEntities: { id: string; name: string; type: string }[] = [];
  const seenUnprofiled = new Set<string>();
  for (const secret of secrets) {
    for (const k of secret.knowledge) {
      if (!profileEntityIds.has(k.worldEntityId) && !seenUnprofiled.has(k.worldEntityId)) {
        seenUnprofiled.add(k.worldEntityId);
        unprofiledEntities.push({ id: k.worldEntityId, name: k.worldEntity.name, type: k.worldEntity.type });
      }
    }
  }

  const toggleInPlay = (id: string) =>
    setInPlayIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (profiles.length === 0 && unprofiledEntities.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No NPCs assigned to this session. Add secrets with NPC assignments in session prep.
      </div>
    );
  }

  const allNpcs = [
    ...profiles.map((p) => ({ id: p.worldEntity.id, name: p.worldEntity.name, type: p.worldEntity.type, profile: p })),
    ...unprofiledEntities.map((e) => ({ id: e.id, name: e.name, type: e.type, profile: null })),
  ];

  return (
    <div className="space-y-2">
      {allNpcs.map(({ id, name, profile }) => {
        const entitySecrets = entitySecretMap.get(id) ?? [];
        const unrevealed = entitySecrets.filter((s) => !s.isRevealed);
        const hasCritical = unrevealed.some((s) => s.knowledge.some((k) => k.worldEntityId === id && k.isCritical));
        const isInPlay = inPlayIds.has(id);
        const isExpanded = expandedIds.has(id);

        const triggeredBehaviors = (profile?.triggeredBehaviors as TriggeredBehavior[] | null) ?? [];
        const criticalDialogue = (profile?.criticalDialogue as CriticalDialogueLine[] | null) ?? [];

        return (
          <div
            key={id}
            className={cn(
              'rounded-md border border-border/40 bg-card/40 transition-colors',
              isInPlay && 'border-amber-500/60 bg-amber-950/20'
            )}
          >
            <div className="flex items-center gap-2 p-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium truncate">{name}</span>
                  {hasCritical && <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />}
                  {unrevealed.length > 0 && (
                    <span className="text-[10px] bg-primary/20 text-primary px-1 rounded shrink-0">
                      {unrevealed.length}
                    </span>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant={isInPlay ? 'default' : 'outline'}
                className="h-6 text-[10px] px-2 shrink-0"
                onClick={() => toggleInPlay(id)}
              >
                {isInPlay ? 'In Play' : 'Mark in play'}
              </Button>
              <button
                onClick={() => toggleExpanded(id)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            </div>

            {isExpanded && (
              <div className="px-3 pb-3 space-y-3 border-t border-border/30 pt-2">
                {profile?.defaultBehavior && (
                  <p className="text-[11px] text-muted-foreground italic">{profile.defaultBehavior}</p>
                )}

                {entitySecrets.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Knows</p>
                    {entitySecrets.map((s) => {
                      const knowledge = s.knowledge.find((k) => k.worldEntityId === id);
                      return (
                        <div
                          key={s.id}
                          className={cn('text-[11px] flex items-start gap-1', s.isRevealed && 'opacity-40 line-through')}
                        >
                          {knowledge?.isCritical && <Star className="h-2.5 w-2.5 text-amber-400 fill-amber-400 mt-0.5 shrink-0" />}
                          <span>
                            <span className="font-medium">{s.name}</span>
                            {knowledge?.revealCondition && (
                              <span className="text-muted-foreground"> — if: {knowledge.revealCondition}</span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {triggeredBehaviors.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Triggers</p>
                    {triggeredBehaviors.map((tb, i) => (
                      <div key={i} className="text-[11px]">
                        <span className="text-muted-foreground">{tb.condition}: </span>
                        <span>{tb.behavior}</span>
                      </div>
                    ))}
                  </div>
                )}

                {criticalDialogue.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Lines</p>
                    {criticalDialogue.map((dl, i) => (
                      <div key={i} className="text-[11px]">
                        <p className="italic text-foreground/80">"{dl.line}"</p>
                        {dl.trigger && <p className="text-muted-foreground text-[10px]">{dl.trigger}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
