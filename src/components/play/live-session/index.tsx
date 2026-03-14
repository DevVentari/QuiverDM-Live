'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { usePlayerSession } from '@/hooks/use-player-session';
import { InitiativeStrip } from './initiative-strip';
import { MyCharacterPanel } from './my-character-panel';
import { DmSpotlight } from './dm-spotlight';
import { QuickActions } from './quick-actions';
import type { PlayerSessionState } from '@/hooks/use-player-session';

interface LiveSessionProps {
  campaignId: string;
  sessionId: string;
}

const DEFAULT_STATE: PlayerSessionState = {
  hp: 10, maxHp: 10, tempHp: 0, conditions: [], spellSlots: {}, hitDice: {},
};

export function LiveSession({ campaignId, sessionId }: LiveSessionProps) {
  const [wsToken, setWsToken] = useState<string | null>(null);
  const getToken = trpc.play.getWsToken.useMutation();

  useEffect(() => {
    getToken.mutateAsync({ sessionId, campaignId }).then(r => setWsToken(r.token)).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, campaignId]);

  const { connected, initiative, spotlight, sendStateUpdate } = usePlayerSession(campaignId, sessionId, wsToken);
  const { data: savedState } = trpc.play.getSessionState.useQuery({ sessionId });
  const updateState = trpc.play.updateSessionState.useMutation();
  const [localState, setLocalState] = useState<PlayerSessionState | null>(null);

  const state: PlayerSessionState = localState ?? (savedState as unknown as PlayerSessionState) ?? DEFAULT_STATE;

  function handleChange(update: Partial<PlayerSessionState>) {
    const next = { ...state, ...update };
    setLocalState(next);
    sendStateUpdate('', next);
    updateState.mutate({ sessionId, hp: next.hp, maxHp: next.maxHp, tempHp: next.tempHp, conditions: next.conditions });
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {initiative && (
        <InitiativeStrip
          participants={initiative.participants}
          currentTurnId={initiative.currentTurnId}
          round={initiative.round}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="w-full md:w-80 md:border-r md:border-white/8 overflow-y-auto">
          <MyCharacterPanel state={state} onChange={handleChange} />
          <QuickActions />
        </div>
        <div className="hidden md:flex flex-1 flex-col overflow-auto">
          <DmSpotlight spotlight={spotlight} />
        </div>
      </div>

      {!connected && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white text-xs px-3 py-1.5 rounded-full">
          Reconnecting...
        </div>
      )}
    </div>
  );
}
