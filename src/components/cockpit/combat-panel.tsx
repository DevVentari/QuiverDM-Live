'use client';

import { useState, useMemo } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/server/routers/_app';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Swords,
  Plus,
  SkipForward,
  ChevronRight,
  ChevronLeft,
  Minus,
  Heart,
  X,
} from 'lucide-react';

type RouterOutput = inferRouterOutputs<AppRouter>;
type Encounter = RouterOutput['encounters']['getBySession'][number];
type Participant = Encounter['participants'][number];

function getHpPct(p: Participant) {
  if (p.maxHp <= 0) return 0;
  return Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100));
}

function getHpBarColor(p: Participant) {
  const pct = getHpPct(p);
  if (!p.isAlive || pct === 0) return 'bg-red-800';
  if (pct <= 25) return 'bg-red-500';
  if (pct <= 50) return 'bg-amber-500';
  return 'bg-emerald-500';
}

interface EncounterBlockProps {
  encounter: Encounter;
  conditions: string[];
  activeTurnIdx: number;
  onTurnIdx: (i: number) => void;
}

function EncounterBlock({ encounter, conditions, activeTurnIdx, onTurnIdx }: EncounterBlockProps) {
  const utils = trpc.useUtils();
  const [newName, setNewName] = useState('');
  const [newInit, setNewInit] = useState('');
  const [newHp, setNewHp] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const sorted = useMemo(
    () => [...encounter.participants].sort((a, b) => b.initiative - a.initiative),
    [encounter.participants]
  );

  const updateParticipant = trpc.encounters.updateParticipant.useMutation({
    onSuccess: () => void utils.encounters.getBySession.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const addParticipant = trpc.encounters.addParticipant.useMutation({
    onSuccess: () => {
      setShowAddForm(false);
      setNewName('');
      setNewInit('');
      setNewHp('');
      void utils.encounters.getBySession.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const nextRound = trpc.encounters.nextRound.useMutation({
    onSuccess: () => void utils.encounters.getBySession.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  function applyDamage(p: Participant, delta: number) {
    const hp = Math.max(0, Math.min(p.maxHp, p.hp + delta));
    updateParticipant.mutate({ participantId: p.id, hp, isAlive: hp > 0 });
  }

  function toggleCondition(p: Participant, condition: string) {
    const current = Array.isArray(p.conditions) ? (p.conditions as string[]) : [];
    const next = current.includes(condition)
      ? current.filter((c) => c !== condition)
      : [...current, condition];
    updateParticipant.mutate({ participantId: p.id, conditions: next });
  }

  const currentParticipant = sorted[activeTurnIdx] ?? null;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Encounter header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold truncate">{encounter.name}</span>
          <Badge variant="secondary" className="text-[10px] shrink-0">Rd {encounter.round}</Badge>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => nextRound.mutate({ encounterId: encounter.id })}
            disabled={nextRound.isPending}
          >
            <SkipForward className="h-3 w-3 mr-1" />
            Next Round
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => setShowAddForm((v) => !v)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Turn nav */}
      {sorted.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-amber-500/5 border-b border-amber-500/20">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5"
            onClick={() => onTurnIdx(activeTurnIdx === 0 ? sorted.length - 1 : activeTurnIdx - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs font-medium text-amber-400 truncate px-1">
            {currentParticipant?.name ?? '—'}
            <span className="text-muted-foreground text-[10px] ml-1.5">
              ({activeTurnIdx + 1}/{sorted.length})
            </span>
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5"
            onClick={() => onTurnIdx((activeTurnIdx + 1) % sorted.length)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Participant list */}
      <div className="divide-y divide-border/50">
        {sorted.map((p, idx) => {
          const isActive = idx === activeTurnIdx;
          const pctHp = getHpPct(p);
          const barColor = getHpBarColor(p);
          const participantConditions = Array.isArray(p.conditions)
            ? (p.conditions as string[])
            : [];

          return (
            <div
              key={p.id}
              className={`px-3 py-2 space-y-2 transition-colors ${
                isActive ? 'bg-amber-500/5' : ''
              } ${!p.isAlive ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground tabular-nums w-5 shrink-0">
                  {p.initiative}
                </span>
                <span className={`text-xs font-medium flex-1 truncate ${isActive ? 'text-amber-400' : ''}`}>
                  {p.name}
                </span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => applyDamage(p, -1)}
                    className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Deal 1 damage"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="text-xs tabular-nums mx-0.5">
                    <Heart className="h-3 w-3 text-red-500 inline mr-0.5" fill="currentColor" strokeWidth={0} />
                    {p.hp}/{p.maxHp}
                  </span>
                  <button
                    type="button"
                    onClick={() => applyDamage(p, 1)}
                    className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    title="Heal 1"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* HP bar */}
              <Progress value={pctHp} className={`h-1 [&>div]:${barColor}`} />

              {/* Active conditions */}
              {participantConditions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {participantConditions.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCondition(p, c)}
                      className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-colors"
                      title={`Remove ${c}`}
                    >
                      {c}
                      <X className="h-2.5 w-2.5" />
                    </button>
                  ))}
                </div>
              )}

              {/* Condition toggle bar — only for active participant */}
              {isActive && conditions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {conditions
                    .filter((c) => !participantConditions.includes(c))
                    .map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleCondition(p, c)}
                        className="rounded px-1.5 py-0.5 text-[9px] text-muted-foreground border border-border hover:bg-muted hover:text-foreground transition-colors"
                      >
                        +{c}
                      </button>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add participant form */}
      {showAddForm && (
        <div className="px-3 py-2 border-t border-border bg-muted/10 space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            <Input
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="col-span-3 h-7 text-xs"
            />
            <Input
              placeholder="Init"
              type="number"
              value={newInit}
              onChange={(e) => setNewInit(e.target.value)}
              className="h-7 text-xs"
            />
            <Input
              placeholder="HP"
              type="number"
              value={newHp}
              onChange={(e) => setNewHp(e.target.value)}
              className="col-span-2 h-7 text-xs"
            />
          </div>
          <Button
            size="sm"
            className="w-full h-7 text-xs"
            disabled={!newName.trim() || !newInit || !newHp || addParticipant.isPending}
            onClick={() =>
              addParticipant.mutate({
                encounterId: encounter.id,
                name: newName.trim(),
                type: 'monster',
                initiative: parseInt(newInit, 10) || 0,
                hp: parseInt(newHp, 10) || 1,
                maxHp: parseInt(newHp, 10) || 1,
              })
            }
          >
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

interface CombatPanelProps {
  sessionId: string;
}

export function CombatPanel({ sessionId }: CombatPanelProps) {
  const [turnIndices, setTurnIndices] = useState<Record<string, number>>({});
  const [newEncounterName, setNewEncounterName] = useState('');
  const utils = trpc.useUtils();

  const encountersQuery = trpc.encounters.getBySession.useQuery({ sessionId }, { refetchInterval: 5000 });
  const conditionsQuery = trpc.encounters.getConditions.useQuery(undefined, { staleTime: 60_000 });

  const createEncounter = trpc.encounters.create.useMutation({
    onSuccess: () => {
      setNewEncounterName('');
      void utils.encounters.getBySession.invalidate({ sessionId });
    },
    onError: (e) => toast.error(e.message),
  });

  const activeEncounters = useMemo(
    () => (encountersQuery.data ?? []).filter((e: Encounter) => e.status === 'active'),
    [encountersQuery.data]
  );

  const conditions = conditionsQuery.data ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 shrink-0">
        <Swords className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex-1">
          Combat
        </span>
        <div className="flex items-center gap-1.5">
          <Input
            value={newEncounterName}
            onChange={(e) => setNewEncounterName(e.target.value)}
            placeholder="New encounter…"
            className="h-7 text-xs w-32"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newEncounterName.trim()) {
                createEncounter.mutate({ sessionId, name: newEncounterName.trim() });
              }
            }}
          />
          <Button
            size="sm"
            className="h-7 px-2"
            onClick={() => createEncounter.mutate({ sessionId, name: newEncounterName.trim() })}
            disabled={!newEncounterName.trim() || createEncounter.isPending}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {encountersQuery.isLoading && (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        )}

        {activeEncounters.length === 0 && !encountersQuery.isLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <Swords className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground italic">No active encounters</p>
            <p className="text-[10px] text-muted-foreground/60">Create one above to start tracking combat</p>
          </div>
        )}

        {activeEncounters.map((encounter: Encounter) => (
          <EncounterBlock
            key={encounter.id}
            encounter={encounter}
            conditions={conditions}
            activeTurnIdx={turnIndices[encounter.id] ?? 0}
            onTurnIdx={(i) => setTurnIndices((prev) => ({ ...prev, [encounter.id]: i }))}
          />
        ))}
      </div>
    </div>
  );
}
