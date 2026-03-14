'use client';

import { useEffect, useRef, useState } from 'react';

export interface InitiativeParticipant {
  id: string;
  name: string;
  initiative: number;
  hp: number;
  maxHp: number;
  isAlive: boolean;
  type: string;
}

export interface SpotlightContent {
  type: 'text' | 'image' | 'statblock' | 'handout';
  content: unknown;
}

export interface PlayerSessionState {
  hp: number;
  maxHp: number;
  tempHp: number;
  conditions: string[];
  spellSlots: Record<string, { used: number; max: number }>;
  hitDice: Record<string, { used: number; max: number }>;
}

export function usePlayerSession(campaignId: string, sessionId: string, token: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [initiative, setInitiative] = useState<{ participants: InitiativeParticipant[]; currentTurnId: string | null; round: number } | null>(null);
  const [spotlight, setSpotlight] = useState<SpotlightContent | null>(null);
  const [partyStates, setPartyStates] = useState<Record<string, PlayerSessionState>>({});

  useEffect(() => {
    if (!campaignId || !token) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3004';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join_live_session', sessionId, token }));
      setConnected(true);
    };

    ws.onclose = () => setConnected(false);

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as { type: string; data?: unknown };
        switch (msg.type) {
          case 'dm:initiative:updated':
            setInitiative(msg.data as { participants: InitiativeParticipant[]; currentTurnId: string | null; round: number });
            break;
          case 'dm:spotlight:pushed': {
            const d = msg.data as { type: string; content: unknown };
            setSpotlight({ type: d.type as SpotlightContent['type'], content: d.content });
            break;
          }
          case 'dm:spotlight:cleared':
            setSpotlight(null);
            break;
          case 'player:state:updated':
            setPartyStates(prev => {
              const d = msg.data as { userId: string } & PlayerSessionState;
              return { ...prev, [d.userId]: d };
            });
            break;
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [campaignId, sessionId, token]);

  function sendStateUpdate(userId: string, state: Partial<PlayerSessionState>) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'player:state:update',
        data: { sessionId, campaignId, userId, ...state },
      }));
    }
  }

  return { connected, initiative, spotlight, partyStates, sendStateUpdate };
}
