'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

interface OverlayState {
  sessionActive: boolean;
  sessionId?: string;
  sessionTitle?: string | null;
  sessionNumber?: number;
  encounter?: {
    name: string;
    round: number;
    participants: Array<{
      name: string;
      hp: number;
      maxHp: number;
      initiative: number;
      isAlive: boolean;
      type: string;
    }>;
  } | null;
}

export default function OverlayPage() {
  const params = useParams<{ campaignId: string }>();
  const campaignId = useMemo(
    () =>
      Array.isArray(params?.campaignId)
        ? params.campaignId[0]
        : params?.campaignId,
    [params]
  );
  const [state, setState] = useState<OverlayState | null>(null);

  useEffect(() => {
    if (!campaignId) {
      return;
    }

    const eventSource = new EventSource(`/api/overlay/${campaignId}`);
    eventSource.onmessage = (event) => {
      const parsed = JSON.parse(event.data) as OverlayState;
      setState(parsed);
    };

    return () => eventSource.close();
  }, [campaignId]);

  if (!state?.sessionActive) {
    return null;
  }

  if (!state.encounter) {
    return (
      <div className="fixed bottom-4 right-4 rounded-lg bg-black/80 p-3 font-mono text-xs text-white min-w-64">
        <div className="font-bold text-yellow-400">
          Session {state.sessionNumber ?? '-'}
        </div>
        {state.sessionTitle && <div className="text-gray-300 mt-1">{state.sessionTitle}</div>}
      </div>
    );
  }

  const encounter = state.encounter;
  const aliveParticipants = encounter.participants
    .filter((participant) => participant.isAlive)
    .sort((a, b) => b.initiative - a.initiative);

  return (
    <div className="fixed bottom-4 right-4 rounded-lg bg-black/80 p-3 font-mono text-xs text-white min-w-64">
      <div className="mb-1 font-bold text-yellow-400">
        {encounter.name} - Round {encounter.round}
      </div>
      {aliveParticipants.map((participant, index) => (
        <div key={`${participant.name}-${index}`} className="flex items-center gap-2 py-0.5">
          <span className="w-4 text-right text-gray-400">{participant.initiative}</span>
          <span className={`flex-1 ${index === 0 ? 'font-bold text-white' : 'text-gray-300'}`}>
            {participant.name}
          </span>
          <span
            className={
              participant.hp < participant.maxHp * 0.25
                ? 'text-red-400'
                : participant.hp < participant.maxHp * 0.5
                  ? 'text-yellow-400'
                  : 'text-green-400'
            }
          >
            {participant.hp}/{participant.maxHp}
          </span>
        </div>
      ))}
    </div>
  );
}

