'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import type { Character, WorldEntity, WorldRelationship } from '@prisma/client';

type CharacterWithBrainEntity = Character & {
  brainEntity?: WorldEntity & { relationships: WorldRelationship[] };
};

interface PlayerCharacterCardProps {
  character: CharacterWithBrainEntity;
  compact?: boolean;
  campaignId?: string;
  className?: string;
}

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function fmtMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

function AbilityScore({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs font-bold uppercase text-foreground/60">{label}</span>
      <span className="text-sm font-bold">{score}</span>
      <span className="text-xs text-muted-foreground">({fmtMod(abilityMod(score))})</span>
    </div>
  );
}

function BrainPanel({
  campaignId,
  characterName,
  brainEntity,
}: {
  campaignId: string;
  characterName: string;
  brainEntity?: WorldEntity & { relationships: WorldRelationship[] };
}) {
  const { data, isLoading } = trpc.brain.entities.list.useQuery(
    { campaignId, search: characterName },
    { staleTime: 60_000, enabled: !brainEntity }
  );

  const entity = brainEntity ?? data?.[0];
  const loading = !brainEntity && isLoading;

  const topRelationships = entity && brainEntity?.relationships
    ? [...brainEntity.relationships]
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 3)
    : [];

  return (
    <div className="border-t border-amber-800/30 pt-2 space-y-1 text-xs">
      <div className="font-bold text-sm uppercase tracking-wide text-amber-700">DM Brain</div>
      {loading && <p className="text-muted-foreground">Loading...</p>}
      {!loading && !entity && (
        <p className="text-muted-foreground">
          Not yet tracked by DM Brain. Seed the Brain to see history here.
        </p>
      )}
      {entity && (
        <>
          {entity.lastSeenSessionId && (
            <p className="text-muted-foreground">
              Last seen: Session {entity.lastSeenSessionId.slice(-6)}
            </p>
          )}
          {entity.description && (
            <p className="text-foreground/80 line-clamp-2">{entity.description}</p>
          )}
          {topRelationships.length > 0 && (
            <div className="space-y-0.5">
              {topRelationships.map((rel) => (
                <p key={rel.id} className="text-muted-foreground">
                  <span className="capitalize font-medium">{rel.type}</span>
                  {rel.description && (
                    <span>: {rel.description}</span>
                  )}
                </p>
              ))}
            </div>
          )}
          <Link
            href={`/campaigns/${campaignId}/brain?entity=${entity.id}`}
            className="text-amber-600 hover:text-amber-500 transition-colors"
          >
            View in Brain →
          </Link>
        </>
      )}
    </div>
  );
}

export function PlayerCharacterCard({
  character,
  compact = false,
  campaignId,
  className,
}: PlayerCharacterCardProps) {
  const [expanded, setExpanded] = useState(!compact);

  const scores = character.abilityScores as {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  } | null;

  const hp = character.hitPoints as { current: number; max: number; temp?: number } | null;

  const senses = character.senses as { passivePerception?: number } | null;
  const passivePerception = senses?.passivePerception ?? (scores ? 10 + abilityMod(scores.wis) : null);

  const initiative = scores ? fmtMod(abilityMod(scores.dex ?? 10)) : null;

  const classLine = [character.class, character.subclass].filter(Boolean).join(' · ');
  const subtitle = [character.race, classLine ? `${classLine} Lv.${character.level}` : `Lv.${character.level}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={cn('border border-amber-800/30 rounded bg-amber-950/10 text-sm', className)}>
      <button
        className="w-full flex items-center gap-3 px-3 py-2 text-left"
        onClick={() => compact && setExpanded((e) => !e)}
      >
        <div className="relative h-10 w-10 shrink-0 rounded overflow-hidden border border-amber-800/30">
          {character.portraitUrl ? (
            <Image src={character.portraitUrl} alt={character.name} fill className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-amber-950/30">
              <Users className="h-5 w-5 text-amber-700/60" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-bold text-foreground truncate">{character.name}</div>
          <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
          {character.background && (
            <div className="text-xs text-muted-foreground truncate">{character.background}</div>
          )}
        </div>

        {compact && (
          <div className="flex items-center gap-3 shrink-0">
            {hp && (
              <span className="text-xs font-semibold text-foreground/80">
                HP {hp.current}/{hp.max}
              </span>
            )}
            {character.armorClass != null && (
              <span className="text-xs font-semibold text-foreground/80">
                AC {character.armorClass}
              </span>
            )}
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="border-t border-amber-800/30 pt-2 grid grid-cols-6 gap-1 text-xs">
            <div className="flex flex-col items-center">
              <span className="font-bold uppercase text-foreground/60">AC</span>
              <span className="font-bold">{character.armorClass ?? '—'}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-bold uppercase text-foreground/60">HP</span>
              <span className="font-bold">
                {hp ? `${hp.current}/${hp.max}` : '—'}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-bold uppercase text-foreground/60">Speed</span>
              <span className="font-bold">{character.speed ?? 30} ft.</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-bold uppercase text-foreground/60">Init</span>
              <span className="font-bold">{initiative ?? '—'}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-bold uppercase text-foreground/60">PP</span>
              <span className="font-bold">{passivePerception ?? '—'}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-bold uppercase text-foreground/60">Prof</span>
              <span className="font-bold">
                {character.proficiencyBonus != null ? `+${character.proficiencyBonus}` : '—'}
              </span>
            </div>
          </div>

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

          {campaignId && (
            <BrainPanel
              campaignId={campaignId}
              characterName={character.name}
              brainEntity={character.brainEntity}
            />
          )}
        </div>
      )}
    </div>
  );
}
