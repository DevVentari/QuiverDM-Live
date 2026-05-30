'use client';

import Image from 'next/image';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NpcInspectorPanelProps {
  npcId: string;
  slug: string;
  isDM: boolean;
}

function abilityMod(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function asModifierText(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return String(value);
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return null;
  return entries
    .map(([key, raw]) => {
      const n = Number(raw);
      return Number.isFinite(n) ? `${key.toUpperCase()} ${n >= 0 ? '+' : ''}${n}` : `${key} ${String(raw)}`;
    })
    .join(INLINE_SEPARATOR);
}

function asListText(value: unknown): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ');
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([key, raw]) => `${key} ${String(raw)}`).join(', ');
  }
  return String(value);
}

function asNamedEntries(value: unknown): Array<{ name?: string; description: string }> {
  if (!value) return [];
  if (typeof value === 'string') return [{ description: value }];
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return { description: item };
      if (!item || typeof item !== 'object') return null;
      const entry = item as { name?: unknown; description?: unknown };
      return {
        name: typeof entry.name === 'string' ? entry.name : undefined,
        description: typeof entry.description === 'string' ? entry.description : '',
      };
    })
    .filter((item): item is { name?: string; description: string } => item !== null && (Boolean(item.name) || Boolean(item.description)));
}

function asActionEntries(value: unknown): Array<{ name?: string; description: string }> {
  if (value && typeof value === 'object' && !Array.isArray(value) && Array.isArray((value as { actions?: unknown }).actions)) {
    return asNamedEntries((value as { actions: unknown }).actions);
  }
  return asNamedEntries(value);
}

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const ABILITY_LABELS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const INLINE_SEPARATOR = ' / ';

export function NpcInspectorPanel({ npcId, slug, isDM }: NpcInspectorPanelProps) {
  const npc = trpc.npcs.getById.useQuery({ id: npcId }, { staleTime: 120_000 });

  if (npc.isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Skeleton className="h-48 w-full rounded-none" />
        <div className="p-4 space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2 mt-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 flex-1 rounded" />)}
          </div>
          <Skeleton className="h-32 w-full rounded mt-4" />
        </div>
      </div>
    );
  }

  if (npc.isError || !npc.data) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Failed to load NPC.
      </div>
    );
  }

  const data = npc.data as any;
  const stats = data.stats as any;
  const abilities = (stats?.abilities ?? stats?.abilityScores) as Record<string, number> | undefined;

  const statPills = [
    { label: 'CR',    value: stats?.cr ?? stats?.challengeRating },
    { label: 'HP',    value: stats?.hp ?? (typeof stats?.hitPoints === 'object' ? stats?.hitPoints?.max : stats?.hitPoints) },
    { label: 'AC',    value: stats?.ac ?? stats?.armorClass },
    { label: 'Speed', value: stats?.speed },
    { label: 'Prof',  value: (stats?.proficiencyBonus ?? stats?.prof) != null ? `+${stats.proficiencyBonus ?? stats.prof}` : undefined },
  ].filter((p) => p.value != null && p.value !== '');

  const savingThrows = asModifierText(stats?.savingThrows);
  const skills = asModifierText(stats?.skills);
  const traits = asNamedEntries(stats?.specialAbilities ?? stats?.traits);
  const actions = asNamedEntries(stats?.actions);
  const reactions = asNamedEntries(stats?.reactions);
  const legendaryActions = asActionEntries(stats?.legendaryActions);
  const lairActions = asNamedEntries(stats?.lairActions);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Portrait */}
      <div className="relative h-52 w-full shrink-0 bg-gradient-to-br from-stone-900 via-amber-950/20 to-stone-900">
        {data.imageUrl && (
          <Image src={data.imageUrl} alt={data.name} fill sizes="448px" className="object-cover object-top opacity-90" unoptimized />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <h3 className="font-display text-xl font-bold" style={{ color: 'hsl(35 30% 90%)' }}>
            {data.name}
          </h3>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {data.faction && (
              <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400/80">
                {data.faction}
              </Badge>
            )}
            {data.role && (
              <Badge variant="outline" className="text-xs border-white/20 text-white/60">
                {data.role}
              </Badge>
            )}
            {data.status && data.status !== 'unknown' && (
              <Badge variant="outline" className={cn(
                'text-xs',
                data.status === 'alive'    && 'border-emerald-500/30 text-emerald-400/80',
                data.status === 'dead'     && 'border-red-500/40 text-red-400/80',
                data.status === 'missing'  && 'border-yellow-500/30 text-yellow-400/80',
                (data.status === 'captured' || data.status === 'fled') && 'border-orange-500/30 text-orange-400/80',
              )}>
                {data.status}
              </Badge>
            )}
            {data.playerVisible && (
              <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400/70">
                Player Visible
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Stat pills */}
      {statPills.length > 0 && (
        <div className="flex divide-x" style={{ borderBottom: '1px solid hsl(35 35% 18%)', borderColor: 'hsl(35 35% 18%)' }}>
          {statPills.map(({ label, value }) => (
            <div key={label} className="stone-card-body flex-1 text-center py-3" style={{ borderColor: 'hsl(35 35% 18%)' }}>
              <div className="stat-value text-base">{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Location */}
      {data.location && (
        <div className="px-4 pt-3 pb-1">
          <p className="label-overline mb-1">Location</p>
          <div className="section-rule mb-2" />
          <p className="text-sm text-muted-foreground">{data.location}</p>
        </div>
      )}

      {/* Ability scores */}
      {abilities && (
        <div className="px-4 pt-4 pb-2">
          <p className="label-overline mb-1">Abilities</p>
          <div className="section-rule mb-3" />
          <div className="grid grid-cols-6 gap-1 text-center">
            {ABILITY_KEYS.map((key, i) => {
              const score = abilities[key];
              return (
                <div key={key} className="bg-white/[0.03] border border-white/[0.06] rounded py-1.5">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60">{ABILITY_LABELS[i]}</p>
                  <p className="text-sm font-bold text-foreground leading-tight">{score ?? '-'}</p>
                  {score != null && (
                    <p className="text-[10px] text-amber-400/70">{abilityMod(score)}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Senses */}
      {stats?.senses && (
        <div className="px-4 pt-3 pb-1">
          <p className="label-overline mb-1">Senses</p>
          <div className="section-rule mb-2" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {asListText(stats.senses)}
          </p>
        </div>
      )}

      {/* Languages */}
      {stats?.languages && (
        <div className="px-4 pt-3 pb-1">
          <p className="label-overline mb-1">Languages</p>
          <div className="section-rule mb-2" />
          <p className="text-xs text-muted-foreground">
            {asListText(stats.languages)}
          </p>
        </div>
      )}

      {/* Damage immunities / resistances / vulnerabilities */}
      {(stats?.damageImmunities || stats?.resistances || stats?.damageResistances || stats?.damageVulnerabilities) && (
        <div className="px-4 pt-3 pb-2">
          <p className="label-overline mb-1">Damage</p>
          <div className="section-rule mb-2" />
          <div className="space-y-1 text-xs text-muted-foreground">
            {stats.damageImmunities && (
              <p>
                <span className="text-foreground/60">Immune:</span>{' '}
                {asListText(stats.damageImmunities)}
              </p>
            )}
            {(stats.resistances ?? stats.damageResistances) && (
              <p>
                <span className="text-foreground/60">Resist:</span>{' '}
                {asListText(stats.resistances ?? stats.damageResistances)}
              </p>
            )}
            {stats.damageVulnerabilities && (
              <p>
                <span className="text-foreground/60">Vulnerable:</span>{' '}
                {asListText(stats.damageVulnerabilities)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Condition immunities */}
      {stats?.conditionImmunities && (
        <div className="px-4 pt-3 pb-1">
          <p className="label-overline mb-1">Condition Immunities</p>
          <div className="section-rule mb-2" />
          <p className="text-xs text-muted-foreground">
            {asListText(stats.conditionImmunities)}
          </p>
        </div>
      )}

      {/* Saving throws */}
      {savingThrows && (
        <div className="px-4 pt-3 pb-1">
          <p className="label-overline mb-1">Saving Throws</p>
          <div className="section-rule mb-2" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {savingThrows}
          </p>
        </div>
      )}

      {/* Skills */}
      {skills && (
        <div className="px-4 pt-3 pb-1">
          <p className="label-overline mb-1">Skills</p>
          <div className="section-rule mb-2" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {skills}
          </p>
        </div>
      )}

      {/* Special abilities / Traits */}
      {traits.length > 0 && (
        <div className="px-4 pt-3 pb-2">
          <p className="label-overline mb-1">Traits</p>
          <div className="section-rule mb-3" />
          <ul className="space-y-2 text-sm text-muted-foreground">
            {traits.slice(0, 5).map((t, index) => (
              <li key={`${t.name ?? 'trait'}-${index}`}>
                {t.name && <span className="text-foreground font-medium">{t.name}. </span>}
                <span>{t.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      {actions.length > 0 && (
        <div className="px-4 pt-3 pb-2">
          <p className="label-overline mb-1">Actions</p>
          <div className="section-rule mb-3" />
          <ul className="space-y-2 text-sm text-muted-foreground">
            {actions.slice(0, 8).map((a, index) => (
              <li key={`${a.name ?? 'action'}-${index}`}>
                {a.name && <span className="text-foreground font-medium">{a.name}. </span>}
                <span>{a.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reactions */}
      {reactions.length > 0 && (
        <div className="px-4 pt-3 pb-2">
          <p className="label-overline mb-1">Reactions</p>
          <div className="section-rule mb-3" />
          <ul className="space-y-2 text-sm text-muted-foreground">
            {reactions.slice(0, 5).map((r, index) => (
              <li key={`${r.name ?? 'reaction'}-${index}`}>
                {r.name && <span className="text-foreground font-medium">{r.name}. </span>}
                <span>{r.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Legendary actions */}
      {legendaryActions.length > 0 && (
        <div className="px-4 pt-3 pb-2">
          <p className="label-overline mb-1">Legendary Actions</p>
          <div className="section-rule mb-3" />
          <ul className="space-y-2 text-sm text-muted-foreground">
            {legendaryActions.slice(0, 5).map((a, index) => (
              <li key={`${a.name ?? 'legendary'}-${index}`}>
                {a.name && <span className="text-foreground font-medium">{a.name}. </span>}
                <span>{a.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Lair actions */}
      {lairActions.length > 0 && (
        <div className="px-4 pt-3 pb-2">
          <p className="label-overline mb-1">Lair Actions</p>
          <div className="section-rule mb-3" />
          <ul className="space-y-2 text-sm text-muted-foreground">
            {lairActions.slice(0, 5).map((a, index) => (
              <li key={`${a.name ?? 'lair'}-${index}`}>
                {a.name && <span className="text-foreground font-medium">{a.name}. </span>}
                <span>{a.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 p-4 space-y-4">
        {(stats?.size || stats?.creatureType || stats?.type || stats?.alignment) && (
          <div>
            <p className="label-overline mb-1">Type</p>
            <div className="section-rule mb-2" />
            <p className="text-sm text-muted-foreground">
              {[stats.size, stats.creatureType ?? stats.type, stats.alignment].filter(Boolean).join(INLINE_SEPARATOR)}
            </p>
          </div>
        )}

        {data.motivation && (
          <div>
            <p className="label-overline mb-1">Motivation</p>
            <div className="section-rule mb-2" />
            <p className="text-sm text-muted-foreground leading-relaxed">{data.motivation}</p>
          </div>
        )}

        {data.personality && (() => {
          const p = data.personality as { traits?: string[]; bonds?: string[]; ideals?: string[]; flaws?: string[] };
          const sections = [
            { label: 'Traits',  items: p.traits },
            { label: 'Ideals',  items: p.ideals },
            { label: 'Bonds',   items: p.bonds },
            { label: 'Flaws',   items: p.flaws },
          ].filter((s) => s.items?.length);
          if (!sections.length) return null;
          return (
            <div>
              <p className="label-overline mb-1">Personality</p>
              <div className="section-rule mb-2" />
              <div className="space-y-2">
                {sections.map((s) => (
                  <div key={s.label}>
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-1">{s.label}</p>
                    <ul className="space-y-0.5">
                      {s.items!.map((item, i) => (
                        <li key={i} className="text-xs text-muted-foreground leading-relaxed">- {item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {data.description && (
          <div>
            <p className="label-overline mb-1">Description</p>
            <div className="section-rule mb-2" />
            <p className="text-sm text-muted-foreground leading-relaxed">{data.description}</p>
          </div>
        )}

        {isDM && data.secrets && (
          <div>
            <p className="label-overline mb-1" style={{ color: 'hsl(35 80% 55% / 0.7)' }}>DM Secrets</p>
            <div className="section-rule mb-2" />
            <div className="stone-card p-3">
              <p className="text-sm leading-relaxed">{data.secrets}</p>
            </div>
          </div>
        )}

        {Array.isArray(data.tags) && data.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(data.tags as string[]).map((t: string) => (
              <Badge key={t} variant="outline" className="text-[10px] py-0 border-white/10 text-muted-foreground">
                {t}
              </Badge>
            ))}
          </div>
        )}

        <div className="pt-2">
          <Button asChild variant="outline" size="sm" className="w-full gap-2">
            <Link href={`/campaigns/${slug}/npcs/${data.id}`}>
              Full Details <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
