'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Loader2, Sword, ExternalLink } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { trpc } from '@/lib/trpc';
import type { CharacterCardData } from './CharacterCard';

interface Props {
  character: CharacterCardData | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const ABILITY_LABELS: Record<typeof ABILITY_KEYS[number], string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
};

function modifier(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function CharacterQuickViewSheet({ character: char, open, onOpenChange }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const syncCharacter = trpc.charactersDndBeyond.syncCharacter.useMutation({
    onSuccess: async (data) => {
      const synced = data.character as { name: string };
      await utils.characters.getMyCharacters.invalidate();
      toast({ title: 'Character synced', description: `${synced.name} was synced from D&D Beyond.` });
    },
    onError: (err) => {
      toast({ title: 'Sync failed', description: err.message, variant: 'destructive' });
    },
  });

  if (!char) return null;

  const activeCampaign = char.campaignCharacters[0]?.campaign ?? null;
  const hp = char.hitPoints ?? { current: 0, max: 0 };
  const metaParts = [char.race, char.class, char.level ? `Level ${char.level}` : null].filter(Boolean);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[400px] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <SheetHeader className="flex flex-row items-center gap-3 px-4 py-4 border-b border-[var(--q-border-subtle)]">
          <div className="relative h-11 w-11 shrink-0 rounded-md overflow-hidden border-2 border-[var(--q-amber-dim)] bg-[oklch(0.10_0.01_265)]">
            {char.portraitUrl ? (
              <Image src={char.portraitUrl} alt={char.name} fill className="object-cover object-top" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-[var(--q-font-display)] text-base text-[var(--q-amber-dim)]">
                  {initials(char.name)}
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-[var(--q-font-display)] text-sm font-semibold text-[var(--q-text)] truncate leading-snug">
              {char.name}
            </p>
            <p className="text-[11px] text-[var(--q-text-dim)] truncate">
              {metaParts.join(' · ') || 'No details'}
            </p>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="w-full rounded-none border-b border-[var(--q-border-subtle)] bg-transparent px-4">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="spells" className="text-xs">Spells</TabsTrigger>
            <TabsTrigger value="inventory" className="text-xs">Inventory</TabsTrigger>
          </TabsList>

          {/* Overview tab */}
          <TabsContent value="overview" className="flex-1 overflow-y-auto px-4 py-4 space-y-5 mt-0">
            {/* Core stats */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[var(--q-text-faint)] mb-2">Core Stats</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'AC', value: char.armorClass ?? '—' },
                  { label: 'HP', value: `${hp.current}/${hp.max}` },
                  { label: 'Prof', value: char.proficiencyBonus ? `+${char.proficiencyBonus}` : '—' },
                  { label: 'Speed', value: char.speed ? `${char.speed}ft` : '—' },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center rounded bg-[oklch(0.10_0.006_265)] border border-[var(--q-border-subtle)] py-2 px-1"
                  >
                    <span className="font-mono text-sm font-bold text-[var(--q-amber)] leading-tight">{value}</span>
                    <span className="text-[9px] uppercase tracking-wider text-[var(--q-text-faint)] mt-0.5">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ability scores */}
            {char.abilityScores && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[var(--q-text-faint)] mb-2">Ability Scores</p>
                <div className="grid grid-cols-6 gap-1.5">
                  {ABILITY_KEYS.map((key) => {
                    const score = char.abilityScores![key];
                    return (
                      <div
                        key={key}
                        className="flex flex-col items-center rounded bg-[oklch(0.10_0.006_265)] border border-[var(--q-border-subtle)] py-2"
                      >
                        <span className="font-mono text-xs font-bold text-[var(--q-amber)]">{score}</span>
                        <span className="font-mono text-[10px] text-[var(--q-text-dim)]">{modifier(score)}</span>
                        <span className="text-[8px] uppercase tracking-wider text-[var(--q-text-faint)] mt-0.5">
                          {ABILITY_LABELS[key]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Campaign */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[var(--q-text-faint)] mb-2">Campaign</p>
              <div className="flex items-center gap-2 rounded bg-[oklch(0.10_0.006_265)] border border-[var(--q-border-subtle)] px-3 py-2">
                <Sword className="h-3.5 w-3.5 shrink-0 text-[var(--q-amber-dim)]" />
                {activeCampaign ? (
                  <span className="text-xs text-[var(--q-amber-dim)] truncate">{activeCampaign.name}</span>
                ) : (
                  <span className="text-xs text-[var(--q-text-faint)] italic">No active campaign</span>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Spells — placeholder */}
          <TabsContent value="spells" className="flex-1 flex items-center justify-center px-4 mt-0">
            <div className="text-center space-y-2">
              <p className="text-sm text-[var(--q-text-dim)]">Spell list available in full sheet</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { onOpenChange(false); router.push(`/characters/${char.id}`); }}
              >
                Open Full Sheet
              </Button>
            </div>
          </TabsContent>

          {/* Inventory — placeholder */}
          <TabsContent value="inventory" className="flex-1 flex items-center justify-center px-4 mt-0">
            <div className="text-center space-y-2">
              <p className="text-sm text-[var(--q-text-dim)]">Inventory available in full sheet</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { onOpenChange(false); router.push(`/characters/${char.id}`); }}
              >
                Open Full Sheet
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--q-border-subtle)] shrink-0">
          <Button
            className="flex-1"
            onClick={() => { onOpenChange(false); router.push(`/characters/${char.id}`); }}
          >
            Open Full Sheet
            <ExternalLink className="ml-2 h-3.5 w-3.5" />
          </Button>
          {char.dndBeyondId && (
            <Button
              variant="outline"
              size="sm"
              disabled={syncCharacter.isPending}
              onClick={() => syncCharacter.mutate({ characterId: char.id })}
            >
              {syncCharacter.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : 'Sync DDB'}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
