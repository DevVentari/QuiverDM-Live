'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Users, Pin, PinOff, Maximize2, Minimize2 } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { usePinnedCharacters } from '@/store/pinned-characters-store';
import { DndIcon, CLASS_ICONS, DAMAGE_ICONS } from '@/components/ui/dnd-icon';
import { OverviewTab } from './sheet-tabs/OverviewTab';
import { CombatTab } from './sheet-tabs/CombatTab';
import { SkillsTab } from './sheet-tabs/SkillsTab';
import { SpellsTab } from './sheet-tabs/SpellsTab';
import {
  fmt,
  abilityMod,
  computeWeaponAttacks,
  type CharacterSheetData,
} from './sheet-utils';

function Portrait({ url, name, size }: { url: string | null; name: string; size: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-10 w-10' : 'h-12 w-12';
  return (
    <div className={`relative ${dim} shrink-0 rounded overflow-hidden border border-amber-800/30`}>
      {url ? (
        <Image src={url} alt={name} fill className="object-cover object-top" unoptimized />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-amber-950/30">
          <Users className="h-5 w-5 text-muted-foreground/30" />
        </div>
      )}
    </div>
  );
}

interface CompactBodyProps {
  char: CharacterSheetData;
  onExpand: () => void;
  isPinned: boolean;
  onPin: () => void;
}

function CompactBody({ char, onExpand, isPinned, onPin }: CompactBodyProps) {
  const abilities = char.abilityScores;
  const hp = char.hitPoints;
  const profBonus = char.proficiencyBonus ?? 2;
  const initiative = abilities ? abilityMod(abilities.dex ?? 10) : null;
  const passivePerc = 10 + (abilities ? abilityMod(abilities.wis ?? 10) : 0);
  const weaponAttacks = computeWeaponAttacks(char.inventory, abilities, profBonus);
  const attackCantrips = (char.spellcasting?.spells ?? [])
    .filter((s) => s.level === 0 && s.damage)
    .map((s) => ({ name: s.name, damage: s.damage as string }));

  const classLine = [char.class, char.subclass].filter(Boolean).join(' / ');
  const identity = [char.race, classLine ? `${classLine} · Lvl ${char.level}` : `Lvl ${char.level}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2.5 p-3 border-b border-border/50">
        <Portrait url={char.portraitUrl} name={char.name} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate leading-tight">{char.name}</p>
          <p className="text-[11px] text-muted-foreground truncate">{identity}</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className={cn('h-7 w-7 shrink-0', isPinned ? 'text-amber-400' : 'text-muted-foreground')}
          onClick={onPin}
          title={isPinned ? 'Unpin' : 'Pin'}
        >
          {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Vitals row */}
      <div className="grid grid-cols-4 gap-1 p-3 pb-0">
        <div className="col-span-2 flex flex-col items-center rounded border border-red-900/40 bg-red-950/20 py-1.5 px-1">
          <span className="text-sm font-bold tabular-nums text-red-400">
            {hp ? `${hp.current}/${hp.max}` : '—'}
          </span>
          {hp?.temp ? (
            <span className="text-[8px] text-amber-400/70">+{hp.temp} temp</span>
          ) : null}
          <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground/50">HP</span>
        </div>
        {[
          { label: 'AC', value: char.armorClass ?? '—' },
          { label: 'Init', value: initiative != null ? fmt(initiative) : '—' },
          { label: 'Perc', value: passivePerc },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center rounded border border-amber-800/20 bg-amber-950/15 py-1.5 px-1">
            <span className="text-sm font-bold tabular-nums">{value}</span>
            <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground/50">{label}</span>
          </div>
        ))}
      </div>

      {/* Attacks */}
      {(weaponAttacks.length > 0 || attackCantrips.length > 0) && (
        <div className="p-3 pt-2.5">
          <p className="text-[8px] font-bold uppercase tracking-[0.15em] text-amber-600/60 mb-1.5">Attacks</p>
          <div className="space-y-1">
            {weaponAttacks.map((atk) => (
              <div key={atk.name} className="flex items-center gap-2 rounded border border-border/30 px-2 py-1">
                <span className="flex-1 text-xs font-medium truncate">{atk.name}</span>
                <span className="font-mono text-xs font-bold text-primary shrink-0">
                  {atk.attackBonus >= 0 ? `+${atk.attackBonus}` : atk.attackBonus}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                  {atk.damage}
                  {atk.damageType && DAMAGE_ICONS[atk.damageType.toLowerCase()] && (
                    <DndIcon name={DAMAGE_ICONS[atk.damageType.toLowerCase()]} className="h-3 w-3 opacity-60" />
                  )}
                </span>
              </div>
            ))}
            {attackCantrips.map((spell) => (
              <div key={spell.name} className="flex items-center gap-2 rounded border border-border/30 px-2 py-1">
                <span className="flex-1 text-xs font-medium truncate">{spell.name}</span>
                <span className="text-[11px] text-muted-foreground">{spell.damage}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expand bar */}
      <button
        onClick={onExpand}
        className="w-full flex items-center justify-between px-3 py-2 border-t border-border/30 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/5 transition-colors"
      >
        <span>Full Sheet</span>
        <Maximize2 className="h-3 w-3" />
      </button>
    </>
  );
}

interface ExpandedBodyProps {
  char: CharacterSheetData;
  onCollapse: () => void;
  isPinned: boolean;
  onPin: () => void;
}

function ExpandedBody({ char, onCollapse, isPinned, onPin }: ExpandedBodyProps) {
  const [tab, setTab] = useState('overview');
  const hasSpells = !!char.spellcasting;

  const classLine = [char.class, char.subclass].filter(Boolean).join(' / ');
  const identity = [
    char.race,
    classLine ? `${classLine} · Level ${char.level}` : `Level ${char.level}`,
    char.background,
  ]
    .filter(Boolean)
    .join(' · ');

  const user = char.user;
  const playerName = user?.displayName ?? user?.name ?? null;

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/50">
        <Portrait url={char.portraitUrl} name={char.name} size="md" />
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-base leading-tight truncate">{char.name}</h2>
          <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 truncate">
            {char.class && CLASS_ICONS[char.class] && (
              <DndIcon name={CLASS_ICONS[char.class]} className="h-3.5 w-3.5 opacity-60 shrink-0" />
            )}
            {identity}
          </p>
          {playerName && (
            <p className="text-[11px] text-amber-600/60 mt-0.5">{playerName}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className={cn('h-8 gap-1.5 text-xs', isPinned ? 'text-amber-400' : 'text-muted-foreground')}
            onClick={onPin}
          >
            {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            {isPinned ? 'Unpin' : 'Pin'}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs text-muted-foreground" onClick={onCollapse}>
            <Minimize2 className="h-3.5 w-3.5" />
            Collapse
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">
        <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-transparent h-auto px-5 gap-0">
          {['overview', 'combat', 'skills', ...(hasSpells ? ['spells'] : [])].map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-amber-500 data-[state=active]:bg-transparent data-[state=active]:text-amber-400 text-xs uppercase tracking-wider font-semibold px-4 py-2.5"
            >
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 overflow-y-auto p-5">
          <TabsContent value="overview" className="mt-0">
            <OverviewTab char={char} />
          </TabsContent>
          <TabsContent value="combat" className="mt-0">
            <CombatTab char={char} />
          </TabsContent>
          <TabsContent value="skills" className="mt-0">
            <SkillsTab char={char} />
          </TabsContent>
          {hasSpells && (
            <TabsContent value="spells" className="mt-0">
              <SpellsTab char={char} />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </>
  );
}

export function CharacterSheetDrawer() {
  const { activeSheet, closeSheet, expandSheet, collapseSheet, isPinned, pin, unpin } =
    usePinnedCharacters();

  const isExpanded = activeSheet?.isExpanded ?? false;

  const { data, isLoading } = trpc.characters.getCharacterSheet.useQuery(
    {
      characterId: activeSheet?.characterId ?? '',
      campaignId: activeSheet?.campaignId ?? '',
    },
    { enabled: !!activeSheet, staleTime: 120_000 }
  );

  const char = data as CharacterSheetData | undefined;
  const pinned = activeSheet ? isPinned(activeSheet.characterId) : false;

  function handlePin() {
    if (!activeSheet) return;
    if (pinned) {
      unpin(activeSheet.characterId);
    } else {
      pin({
        characterId: activeSheet.characterId,
        campaignId: activeSheet.campaignId,
        name: activeSheet.name,
        portraitUrl: activeSheet.portraitUrl,
      });
    }
  }

  return (
    <Sheet open={!!activeSheet} onOpenChange={(open) => { if (!open) closeSheet(); }}>
      <SheetContent
        className={cn(
          'w-full p-0 flex flex-col gap-0 overflow-hidden',
          isExpanded ? 'sm:max-w-[85vw]' : 'sm:max-w-[400px]'
        )}
        style={{ transition: 'max-width 300ms ease-in-out' }}
      >
        {isLoading && (
          <div className="p-4 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}
        {char && !isExpanded && (
          <CompactBody
            char={char}
            onExpand={expandSheet}
            isPinned={pinned}
            onPin={handlePin}
          />
        )}
        {char && isExpanded && (
          <ExpandedBody
            char={char}
            onCollapse={collapseSheet}
            isPinned={pinned}
            onPin={handlePin}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
