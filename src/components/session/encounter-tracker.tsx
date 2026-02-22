'use client';

import { useMemo, useState } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/server/routers/_app';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Swords, Plus, SkipForward, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

type RouterOutput = inferRouterOutputs<AppRouter>;
type Encounter = RouterOutput['encounters']['getBySession'][number];
type EncounterParticipant = Encounter['participants'][number];

interface EncounterTrackerProps {
  sessionId: string;
  isDM: boolean;
}

interface AddParticipantState {
  encounterId: string;
  name: string;
  type: 'pc' | 'npc' | 'monster';
  initiative: string;
  hp: string;
  maxHp: string;
  npcId: string;
}

function getHpPercent(participant: EncounterParticipant) {
  if (participant.maxHp <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (participant.hp / participant.maxHp) * 100));
}

export function EncounterTracker({ sessionId, isDM }: EncounterTrackerProps) {
  const utils = trpc.useUtils();
  const [newEncounterName, setNewEncounterName] = useState('');
  const [conditionDrafts, setConditionDrafts] = useState<Record<string, string>>({});
  const [addParticipantState, setAddParticipantState] = useState<AddParticipantState | null>(null);

  const encountersQuery = trpc.encounters.getBySession.useQuery({ sessionId });
  const conditionsQuery = trpc.encounters.getConditions.useQuery(undefined, {
    staleTime: 60_000,
  });

  const createEncounter = trpc.encounters.create.useMutation({
    onSuccess: () => {
      setNewEncounterName('');
      void utils.encounters.getBySession.invalidate({ sessionId });
    },
    onError: (error) => toast.error(error.message),
  });

  const addParticipant = trpc.encounters.addParticipant.useMutation({
    onSuccess: () => {
      setAddParticipantState(null);
      void utils.encounters.getBySession.invalidate({ sessionId });
    },
    onError: (error) => toast.error(error.message),
  });

  const updateParticipant = trpc.encounters.updateParticipant.useMutation({
    onSuccess: () => {
      void utils.encounters.getBySession.invalidate({ sessionId });
    },
    onError: (error) => toast.error(error.message),
  });

  const nextRound = trpc.encounters.nextRound.useMutation({
    onSuccess: () => {
      void utils.encounters.getBySession.invalidate({ sessionId });
      void utils.sessions.getById.invalidate({ id: sessionId });
    },
    onError: (error) => toast.error(error.message),
  });

  const completeEncounter = trpc.encounters.complete.useMutation({
    onSuccess: () => {
      void utils.encounters.getBySession.invalidate({ sessionId });
    },
    onError: (error) => toast.error(error.message),
  });

  const removeParticipant = trpc.encounters.deleteParticipant.useMutation({
    onSuccess: () => {
      void utils.encounters.getBySession.invalidate({ sessionId });
    },
    onError: (error) => toast.error(error.message),
  });

  const activeEncounters = useMemo(
    () => (encountersQuery.data ?? []).filter((encounter: Encounter) => encounter.status === 'active'),
    [encountersQuery.data]
  );

  const allConditions = conditionsQuery.data ?? [];

  function updateHp(participant: EncounterParticipant, delta: number) {
    const hp = Math.max(0, Math.min(participant.maxHp, participant.hp + delta));
    updateParticipant.mutate({
      participantId: participant.id,
      hp,
      isAlive: hp > 0,
    });
  }

  function addCondition(participant: EncounterParticipant) {
    const condition = conditionDrafts[participant.id];
    if (!condition) {
      return;
    }

    const currentConditions = Array.isArray(participant.conditions)
      ? (participant.conditions as string[])
      : [];

    if (!allConditions.includes(condition)) {
      toast.error('Invalid condition');
      return;
    }

    if (currentConditions.includes(condition)) {
      toast.error('Condition already applied');
      return;
    }

    updateParticipant.mutate({
      participantId: participant.id,
      conditions: [...currentConditions, condition],
    });
    setConditionDrafts((prev) => ({ ...prev, [participant.id]: '' }));
  }

  function removeCondition(participant: EncounterParticipant, conditionToRemove: string) {
    const currentConditions = Array.isArray(participant.conditions)
      ? (participant.conditions as string[])
      : [];

    updateParticipant.mutate({
      participantId: participant.id,
      conditions: currentConditions.filter((condition) => condition !== conditionToRemove),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold flex items-center gap-2">
          <Swords className="h-4 w-4" />
          Encounters
        </h3>
        {isDM && (
          <div className="flex items-center gap-2">
            <Input
              value={newEncounterName}
              onChange={(event) => setNewEncounterName(event.target.value)}
              placeholder="Encounter name"
              className="h-8 text-sm w-44"
            />
            <Button
              size="sm"
              onClick={() =>
                createEncounter.mutate({ sessionId, name: newEncounterName.trim() })
              }
              disabled={!newEncounterName.trim() || createEncounter.isPending}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {encountersQuery.isLoading && (
        <p className="text-sm text-muted-foreground">Loading encounters...</p>
      )}

      {!encountersQuery.isLoading && activeEncounters.length === 0 && (
        <p className="text-sm text-muted-foreground">No active encounters.</p>
      )}

      {activeEncounters.map((encounter: Encounter) => (
        <Card key={encounter.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {encounter.name}
                <Badge variant="secondary">Round {encounter.round}</Badge>
              </CardTitle>
              {isDM && (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => nextRound.mutate({ encounterId: encounter.id })}
                    disabled={nextRound.isPending}
                  >
                    <SkipForward className="h-3 w-3 mr-1" />
                    Next Round
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => completeEncounter.mutate({ encounterId: encounter.id })}
                    disabled={completeEncounter.isPending}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    End
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {encounter.participants.length === 0 && (
              <p className="text-xs text-muted-foreground">No participants yet.</p>
            )}

            {encounter.participants.map((participant: EncounterParticipant) => {
              const conditions = Array.isArray(participant.conditions)
                ? (participant.conditions as string[])
                : [];

              return (
                <div
                  key={participant.id}
                  className={`rounded-md border p-2 space-y-2 ${
                    !participant.isAlive ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground w-6">
                      {participant.initiative}
                    </span>
                    <span className="text-sm font-medium flex-1">{participant.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {participant.type}
                    </Badge>
                    {isDM ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          onClick={() => updateHp(participant, -1)}
                        >
                          -1
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          onClick={() => updateHp(participant, 1)}
                        >
                          +1
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs text-destructive"
                          onClick={() =>
                            removeParticipant.mutate({ participantId: participant.id })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {participant.hp}/{participant.maxHp} HP
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">HP</span>
                      <span className="font-mono">
                        {participant.hp}/{participant.maxHp}
                      </span>
                    </div>
                    <Progress value={getHpPercent(participant)} className="h-2" />
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {conditions.map((condition) => (
                      <Badge key={condition} variant="destructive" className="text-[10px]">
                        {condition}
                        {isDM && (
                          <button
                            className="ml-1 opacity-80 hover:opacity-100"
                            onClick={() => removeCondition(participant, condition)}
                            aria-label={`Remove ${condition}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </Badge>
                    ))}
                    {conditions.length === 0 && (
                      <span className="text-xs text-muted-foreground">No conditions</span>
                    )}
                  </div>

                  {isDM && (
                    <div className="flex items-center gap-2">
                      <select
                        className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                        value={conditionDrafts[participant.id] ?? ''}
                        onChange={(event) =>
                          setConditionDrafts((prev) => ({
                            ...prev,
                            [participant.id]: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select condition</option>
                        {allConditions.map((condition) => (
                          <option key={condition} value={condition}>
                            {condition}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => addCondition(participant)}
                        disabled={!conditionDrafts[participant.id]}
                      >
                        Add Condition
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}

            {isDM && (
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-xs"
                onClick={() =>
                  setAddParticipantState({
                    encounterId: encounter.id,
                    name: '',
                    type: 'npc',
                    initiative: '10',
                    hp: '10',
                    maxHp: '10',
                    npcId: '',
                  })
                }
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Participant
              </Button>
            )}
          </CardContent>
        </Card>
      ))}

      {addParticipantState && (
        <Dialog open onOpenChange={() => setAddParticipantState(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Participant</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={addParticipantState.name}
                  onChange={(event) =>
                    setAddParticipantState((prev) =>
                      prev ? { ...prev, name: event.target.value } : prev
                    )
                  }
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={addParticipantState.type}
                  onChange={(event) =>
                    setAddParticipantState((prev) =>
                      prev
                        ? {
                            ...prev,
                            type: event.target.value as AddParticipantState['type'],
                          }
                        : prev
                    )
                  }
                >
                  <option value="pc">PC</option>
                  <option value="npc">NPC</option>
                  <option value="monster">Monster</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Initiative</Label>
                  <Input
                    value={addParticipantState.initiative}
                    onChange={(event) =>
                      setAddParticipantState((prev) =>
                        prev ? { ...prev, initiative: event.target.value } : prev
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">HP</Label>
                  <Input
                    value={addParticipantState.hp}
                    onChange={(event) =>
                      setAddParticipantState((prev) =>
                        prev ? { ...prev, hp: event.target.value } : prev
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max HP</Label>
                  <Input
                    value={addParticipantState.maxHp}
                    onChange={(event) =>
                      setAddParticipantState((prev) =>
                        prev ? { ...prev, maxHp: event.target.value } : prev
                      )
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">NPC ID (optional)</Label>
                <Input
                  value={addParticipantState.npcId}
                  onChange={(event) =>
                    setAddParticipantState((prev) =>
                      prev ? { ...prev, npcId: event.target.value } : prev
                    )
                  }
                  placeholder="Link to campaign NPC record"
                />
              </div>

              <Button
                className="w-full"
                onClick={() =>
                  addParticipant.mutate({
                    encounterId: addParticipantState.encounterId,
                    name: addParticipantState.name.trim(),
                    type: addParticipantState.type,
                    initiative: Number.parseInt(addParticipantState.initiative, 10) || 0,
                    hp: Number.parseInt(addParticipantState.hp, 10) || 0,
                    maxHp: Number.parseInt(addParticipantState.maxHp, 10) || 1,
                    ...(addParticipantState.npcId.trim()
                      ? { npcId: addParticipantState.npcId.trim() }
                      : {}),
                  })
                }
                disabled={!addParticipantState.name.trim() || addParticipant.isPending}
              >
                Add Participant
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
