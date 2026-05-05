'use client';

import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Pin, PinOff, X } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { usePinnedItems, type PinnedEntityType } from '@/store/pinned-items-store';
import { cn } from '@/lib/utils';

interface CompendiumItemSheetProps {
  entityType: PinnedEntityType;
  entityId: string;
  open: boolean;
  onClose: () => void;
}

export function CompendiumItemSheet({ entityType, entityId, open, onClose }: CompendiumItemSheetProps) {
  const router = useRouter();
  const pathname = usePathname();
  const slug = pathname.match(/\/campaigns\/([^/]+)/)?.[1] ?? '';
  const { isPinned, pin, unpin } = usePinnedItems();
  const pinned = isPinned(entityId);

  const npc = trpc.npcs.getById.useQuery(
    { id: entityId },
    { enabled: open && entityType === 'npc' }
  );
  const homebrew = trpc.homebrew.getContentById.useQuery(
    { id: entityId },
    { enabled: open && ['item', 'location', 'spell', 'monster'].includes(entityType) }
  );
  const encounter = trpc.encounterPlans.getById.useQuery(
    { planId: entityId },
    { enabled: open && entityType === 'encounter' }
  );

  function getEntityName(): string {
    if (entityType === 'npc') return (npc.data as any)?.name ?? '…';
    if (entityType === 'encounter') return (encounter.data as any)?.name ?? '…';
    return (homebrew.data as any)?.name ?? '…';
  }

  function getPagePath(): string {
    const base = `/campaigns/${slug}`;
    if (entityType === 'npc') return `${base}/npcs/${entityId}`;
    if (entityType === 'encounter') return `${base}/encounters/${entityId}`;
    return `${base}/homebrew/${entityId}`;
  }

  function handlePinToggle() {
    if (pinned) {
      unpin(entityId);
      onClose();
    } else {
      pin({ id: entityId, entityType, name: getEntityName(), order: 0 });
    }
  }

  const entityName = getEntityName();

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[420px] p-0 flex flex-col bg-[hsl(240,10%,8%)] border-l border-[hsl(35_35%_18%)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[hsl(35_35%_16%)] flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <EntityIcon entityType={entityType} name={entityName} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{entityName}</p>
              <p className="text-[11px] text-muted-foreground capitalize">{entityType}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePinToggle}
              className={cn(
                'h-7 text-[11px] gap-1',
                pinned ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/15' : ''
              )}
            >
              {pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
              {pinned ? 'Unpin' : 'Pin'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { router.push(getPagePath()); onClose(); }}
              className="h-7 text-[11px] gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              Open
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {entityType === 'npc' && <NpcContent data={npc.data as any} loading={npc.isLoading} />}
          {['item', 'location', 'spell', 'monster'].includes(entityType) && (
            <HomebrewContent data={homebrew.data as any} loading={homebrew.isLoading} entityType={entityType} />
          )}
          {entityType === 'encounter' && <EncounterContent data={encounter.data as any} loading={encounter.isLoading} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EntityIcon({ entityType, name }: { entityType: PinnedEntityType; name: string }) {
  const typeConfig: Record<PinnedEntityType, { bg: string; border: string; text: string; icon?: string; round: boolean }> = {
    npc:      { bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   text: 'text-amber-400',   round: true },
    item:     { bg: 'bg-indigo-500/15',  border: 'border-indigo-500/30',  text: 'text-indigo-400',  icon: '⚔',  round: false },
    location: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400', icon: '🗺', round: false },
    spell:    { bg: 'bg-violet-500/15',  border: 'border-violet-500/30',  text: 'text-violet-400',  icon: '✦',  round: false },
    monster:  { bg: 'bg-red-500/15',     border: 'border-red-500/30',     text: 'text-red-400',     icon: '💀', round: false },
    encounter:{ bg: 'bg-orange-500/15',  border: 'border-orange-500/30',  text: 'text-orange-400',  icon: '⚡', round: false },
  };
  const cfg = typeConfig[entityType];
  return (
    <div className={cn(
      'w-8 h-8 flex items-center justify-center border text-sm font-bold flex-shrink-0',
      cfg.bg, cfg.border, cfg.text,
      cfg.round ? 'rounded-full' : 'rounded-md'
    )}>
      {cfg.icon ?? name.charAt(0).toUpperCase()}
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded p-2 text-center">
      <p className="text-sm font-bold text-foreground">{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-2">{label}</p>;
}

function NpcContent({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!data) return null;
  const stats = data.stats ?? {};
  return (
    <div className="space-y-4">
      {(stats.hp || stats.ac || stats.speed) && (
        <div>
          <SectionLabel label="Combat" />
          <div className="grid grid-cols-4 gap-2">
            {stats.hp    && <StatBlock label="HP"    value={stats.hp} />}
            {stats.ac    && <StatBlock label="AC"    value={stats.ac} />}
            {stats.prof  && <StatBlock label="Prof"  value={`+${stats.prof}`} />}
            {stats.speed && <StatBlock label="Speed" value={stats.speed} />}
          </div>
        </div>
      )}
      {stats.abilities && (
        <div>
          <SectionLabel label="Abilities" />
          <div className="grid grid-cols-6 gap-1.5 text-center">
            {(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const).map((a) => (
              <div key={a}>
                <p className="text-sm font-bold text-foreground">{stats.abilities[a.toLowerCase()] ?? '—'}</p>
                <p className="text-[9px] text-muted-foreground">{a}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.description && (
        <div>
          <SectionLabel label="Description" />
          <p className="text-xs text-muted-foreground leading-relaxed">{data.description}</p>
        </div>
      )}
      {data.faction && (
        <div>
          <SectionLabel label="Faction" />
          <p className="text-xs text-foreground">{data.faction}</p>
        </div>
      )}
      {data.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(data.tags as string[]).map((t) => (
            <Badge key={t} variant="outline" className="text-[10px] py-0">{t}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function HomebrewContent({ data, loading, entityType }: { data: any; loading: boolean; entityType: PinnedEntityType }) {
  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!data) return null;
  const d = data.data ?? {};
  const labels: Record<string, string[]> = {
    item:     ['type', 'rarity', 'attunement', 'weight', 'cost'],
    location: ['region', 'type', 'population'],
    spell:    ['level', 'school', 'castingTime', 'range', 'duration', 'components'],
    monster:  ['cr', 'type', 'alignment', 'hp', 'ac'],
  };
  const fields = labels[entityType] ?? [];
  return (
    <div className="space-y-4">
      {fields.some((f) => d[f]) && (
        <div className="grid grid-cols-2 gap-2">
          {fields.filter((f) => d[f]).map((f) => (
            <div key={f} className="bg-white/[0.03] border border-white/[0.06] rounded p-2">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{f}</p>
              <p className="text-xs text-foreground mt-0.5">{String(d[f])}</p>
            </div>
          ))}
        </div>
      )}
      {(d.description ?? data.description) && (
        <div>
          <SectionLabel label="Description" />
          <p className="text-xs text-muted-foreground leading-relaxed">{d.description ?? data.description}</p>
        </div>
      )}
      {data.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(data.tags as string[]).map((t) => (
            <Badge key={t} variant="outline" className="text-[10px] py-0">{t}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function EncounterContent({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!data) return null;
  return (
    <div className="space-y-4">
      {(data.difficulty || data.partySize || data.partyLevel) && (
        <div className="grid grid-cols-3 gap-2">
          {data.difficulty && <StatBlock label="Difficulty" value={data.difficulty} />}
          {data.partySize  && <StatBlock label="Party"      value={data.partySize} />}
          {data.partyLevel && <StatBlock label="Level"      value={data.partyLevel} />}
        </div>
      )}
      {data.participants?.length > 0 && (
        <div>
          <SectionLabel label="Creatures" />
          <div className="space-y-1">
            {(data.participants as any[]).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-white/[0.04]">
                <span className="text-foreground">{p.name}</span>
                <span className="text-muted-foreground">HP {p.maxHp}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.notes && (
        <div>
          <SectionLabel label="Notes" />
          <p className="text-xs text-muted-foreground leading-relaxed">{data.notes}</p>
        </div>
      )}
    </div>
  );
}
