'use client';

import { useEffect, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import {
  applyTurn,
  emptyTranscript,
  visibleTurns,
  type LiveTurn,
  type LiveTranscriptState,
} from '@/lib/live/transcript-reducer';

export interface DmHint {
  text: string;
  priority: 'info' | 'important';
  effectName?: string;
}

/**
 * Subscribe to a session's live transcript + DM hints over the WebSocket
 * (port 3004). Mints a short-lived join token via play.getWsToken, connects,
 * joins the live session, and folds `live_transcript` turns through the pure
 * reducer while collecting `dm_hints`. No-ops (returns disconnected) when
 * disabled, so callers can gate it on `session.status === 'in_progress'`.
 */
export function useLiveTranscript(
  campaignId: string,
  sessionId: string,
  enabled: boolean,
) {
  const getToken = trpc.play.getWsToken.useMutation();
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<LiveTranscriptState>(emptyTranscript);
  const [hints, setHints] = useState<DmHint[]>([]);

  useEffect(() => {
    if (!enabled || !campaignId || !sessionId) return;
    let cancelled = false;
    let ws: WebSocket | null = null;

    (async () => {
      let token: string;
      try {
        const res = await getToken.mutateAsync({ sessionId, campaignId });
        token = res.token;
      } catch {
        return; // not a member / mint failed — stay disconnected
      }
      if (cancelled) return;

      const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3004';
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: 'join_live_session', sessionId, token }));
        setConnected(true);
      };
      ws.onclose = () => setConnected(false);
      ws.onerror = () => setConnected(false);
      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            turn?: LiveTurn;
            hints?: DmHint[];
          };
          if (msg.type === 'live_transcript' && msg.turn) {
            setState((prev) => applyTurn(prev, msg.turn as LiveTurn));
          } else if (msg.type === 'dm_hints' && Array.isArray(msg.hints)) {
            setHints(msg.hints);
          }
        } catch {
          // ignore malformed frames
        }
      };
    })();

    return () => {
      cancelled = true;
      ws?.close();
      wsRef.current = null;
      setConnected(false);
    };
    // getToken is stable enough; re-subscribe only when the target changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, campaignId, sessionId]);

  return { connected, turns: visibleTurns(state), hints };
}
